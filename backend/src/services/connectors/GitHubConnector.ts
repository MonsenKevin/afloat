import { GitHubCredentials, IndexedDocument, IntegrationConfig } from '../../types';
import { decrypt } from '../credentialStore';
import { getDb, saveDb } from '../../db';
import { Connector } from './types';

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
    console.error('GitHubConnector: failed to update integration_configs error status', dbErr);
  }
}

/**
 * Fetches a GitHub API URL with retry logic for HTTP 429 responses.
 * Retries up to maxRetries times, honouring the X-RateLimit-Reset header (Unix timestamp).
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

    // X-RateLimit-Reset is a Unix timestamp (seconds)
    const resetHeader = response.headers.get('X-RateLimit-Reset');
    let waitMs = 60_000; // default 1 minute
    if (resetHeader) {
      const resetTimestamp = parseInt(resetHeader, 10);
      if (!isNaN(resetTimestamp)) {
        const nowMs = Date.now();
        const resetMs = resetTimestamp * 1000;
        waitMs = Math.max(resetMs - nowMs, 0) + 1000; // +1s buffer
      }
    }

    console.warn(
      `GitHubConnector: rate limited (429). Waiting ${waitMs}ms before retry ${attempt}/${maxRetries - 1}.`
    );
    await sleep(waitMs);
  }
}

/**
 * GitHub PR shape returned by the API.
 */
interface GitHubPR {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  updated_at: string;
}

/**
 * GitHub README shape returned by the API.
 */
interface GitHubReadme {
  content: string;
  html_url: string;
}

export const GitHubConnector: Connector = {
  provider: 'github',

  async fetch(config: IntegrationConfig): Promise<IndexedDocument[]> {
    // 1. Decrypt credentials
    const credentialsJson = decrypt(config.encryptedCredentials);
    const credentials: GitHubCredentials = JSON.parse(credentialsJson);
    const { token, repos } = credentials;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    };

    const documents: IndexedDocument[] = [];
    const fetchedAt = new Date().toISOString();
    const cutoffDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

    for (const repo of repos) {
      // 2a. Fetch PRs
      const prsUrl = `https://api.github.com/repos/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=100`;

      let prsResponse: Response;
      try {
        prsResponse = await fetchWithRetry(prsUrl, headers);
      } catch (networkErr) {
        throw networkErr;
      }

      if (prsResponse.status === 401 || prsResponse.status === 403) {
        markConfigError(config.id, 'Authentication failed');
        throw new Error(
          `GitHubConnector: authentication failed (HTTP ${prsResponse.status}) for config ${config.id}`
        );
      }

      if (prsResponse.status === 429) {
        throw new Error(
          `GitHubConnector: rate limit exceeded after max retries for config ${config.id}`
        );
      }

      if (!prsResponse.ok) {
        throw new Error(
          `GitHubConnector: unexpected HTTP ${prsResponse.status} fetching PRs for repo ${repo}`
        );
      }

      const prs = (await prsResponse.json()) as GitHubPR[];

      for (const pr of prs) {
        // Filter to PRs updated within the last 60 days
        const updatedAt = new Date(pr.updated_at);
        if (updatedAt < cutoffDate) {
          continue;
        }

        documents.push({
          id: `${config.orgId}:github:pr:${repo}:${pr.number}`,
          orgId: config.orgId,
          provider: 'github',
          sourceId: `pr:${repo}:${pr.number}`,
          title: pr.title,
          content: pr.body || pr.title,
          url: pr.html_url,
          fetchedAt,
        } satisfies IndexedDocument);
      }

      // 2b. Fetch README
      const readmeUrl = `https://api.github.com/repos/${repo}/readme`;

      let readmeResponse: Response;
      try {
        readmeResponse = await fetchWithRetry(readmeUrl, headers);
      } catch (networkErr) {
        throw networkErr;
      }

      if (readmeResponse.status === 404) {
        // Repo may not have a README — skip silently
        continue;
      }

      if (readmeResponse.status === 401 || readmeResponse.status === 403) {
        markConfigError(config.id, 'Authentication failed');
        throw new Error(
          `GitHubConnector: authentication failed (HTTP ${readmeResponse.status}) for config ${config.id}`
        );
      }

      if (readmeResponse.status === 429) {
        throw new Error(
          `GitHubConnector: rate limit exceeded after max retries for config ${config.id}`
        );
      }

      if (!readmeResponse.ok) {
        throw new Error(
          `GitHubConnector: unexpected HTTP ${readmeResponse.status} fetching README for repo ${repo}`
        );
      }

      const readme = (await readmeResponse.json()) as GitHubReadme;
      const decodedContent = Buffer.from(readme.content, 'base64').toString('utf-8');

      documents.push({
        id: `${config.orgId}:github:readme:${repo}`,
        orgId: config.orgId,
        provider: 'github',
        sourceId: `readme:${repo}`,
        title: `${repo} README`,
        content: decodedContent,
        url: readme.html_url,
        fetchedAt,
      } satisfies IndexedDocument);
    }

    return documents;
  },
};
