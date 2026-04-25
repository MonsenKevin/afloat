import { GranolaCredentials, IndexedDocument, IntegrationConfig } from '../../types';
import { decrypt } from '../credentialStore';
import { getDb, saveDb } from '../../db';
import { Connector } from './types';

interface GranolaDocument {
  id: string;
  title: string;
  body: string | null;
  permalink: string;
  updatedAt: string; // ISO 8601
}

interface GranolaApiResponse {
  documents: GranolaDocument[];
}

/**
 * Waits for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Marks an integration config as errored in the database.
 */
function markConfigError(configId: string, errorMessage: string): void {
  try {
    const db = getDb();
    db.prepare(
      `UPDATE integration_configs
       SET status = 'error', error_message = ?, updated_at = ?
       WHERE id = ?`
    ).run(errorMessage, new Date().toISOString(), configId);
    saveDb();
  } catch (dbErr) {
    console.error('GranolaConnector: failed to update integration_configs error status', dbErr);
  }
}

/**
 * Fetches Granola documents with retry logic for HTTP 429 responses.
 * Waits 60 seconds between retries, up to maxRetries times.
 */
async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  maxRetries = 3
): Promise<Response> {
  let attempt = 0;

  while (true) {
    const response = await fetch(url, { headers });

    if (response.status !== 429) {
      return response;
    }

    attempt++;
    if (attempt >= maxRetries) {
      // Return the 429 response so the caller can throw
      return response;
    }

    console.warn(
      `GranolaConnector: rate limited (429). Waiting 60s before retry ${attempt}/${maxRetries - 1}.`
    );
    await sleep(60_000);
  }
}

export const GranolaConnector: Connector = {
  provider: 'granola',

  async fetch(config: IntegrationConfig): Promise<IndexedDocument[]> {
    // 1. Decrypt credentials
    const credentialsJson = decrypt(config.encryptedCredentials);
    const credentials: GranolaCredentials = JSON.parse(credentialsJson);
    const { apiKey } = credentials;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    };

    const apiUrl = 'https://api.granola.ai/v1/documents';

    // 2. Fetch documents with retry support
    let response: Response;
    try {
      response = await fetchWithRetry(apiUrl, headers);
    } catch (networkErr) {
      console.warn('GranolaConnector: network error or API unreachable', networkErr);
      return [];
    }

    // 3. Handle error status codes
    if (response.status === 401 || response.status === 403) {
      markConfigError(config.id, 'Authentication failed');
      throw new Error(`GranolaConnector: authentication failed (HTTP ${response.status}) for config ${config.id}`);
    }

    if (response.status === 429) {
      throw new Error(`GranolaConnector: rate limit exceeded after max retries for config ${config.id}`);
    }

    if (!response.ok) {
      throw new Error(`GranolaConnector: unexpected HTTP ${response.status} for config ${config.id}`);
    }

    // 4. Parse response
    const data = await response.json() as GranolaApiResponse;
    const documents = data.documents ?? [];

    // 5. Filter to notes updated within the last 60 days
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const recentDocuments = documents.filter(doc => {
      const updatedAt = new Date(doc.updatedAt);
      return updatedAt >= sixtyDaysAgo;
    });

    // 6. Normalize each note to IndexedDocument
    const fetchedAt = new Date().toISOString();

    return recentDocuments.map(note => ({
      id: `${config.orgId}:granola:${note.id}`,
      orgId: config.orgId,
      provider: 'granola',
      sourceId: note.id,
      title: note.title,
      content: note.body || note.title,
      url: note.permalink,
      fetchedAt,
    } satisfies IndexedDocument));
  },
};
