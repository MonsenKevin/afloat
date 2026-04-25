import { IndexedDocument, IntegrationConfig, OutlookCredentials } from '../../types';
import { decrypt, encrypt } from '../credentialStore';
import { getDb, saveDb } from '../../db';
import { Connector } from './types';

/**
 * Strips HTML tags and decodes common HTML entities from a string.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
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
    console.error('OutlookConnector: failed to update integration_configs error status', dbErr);
  }
}

/**
 * Attempts to refresh the OAuth access token using the refresh token.
 * On success, updates the integration_configs row with new encrypted credentials.
 * On failure, marks the config as errored and throws.
 *
 * Returns the new access token on success.
 */
async function refreshAccessToken(
  config: IntegrationConfig,
  credentials: OutlookCredentials
): Promise<string> {
  const clientId = process.env.OUTLOOK_CLIENT_ID;
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: credentials.refreshToken,
    client_id: clientId ?? '',
    client_secret: clientSecret ?? '',
  });

  let refreshResponse: Response;
  try {
    refreshResponse = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }
    );
  } catch (networkErr) {
    markConfigError(config.id, 'OAuth token refresh failed');
    throw networkErr;
  }

  if (!refreshResponse.ok) {
    markConfigError(config.id, 'OAuth token refresh failed');
    throw new Error(
      `OutlookConnector: token refresh failed (HTTP ${refreshResponse.status}) for config ${config.id}`
    );
  }

  const tokenData = await refreshResponse.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const newAccessToken = tokenData.access_token;
  const newRefreshToken = tokenData.refresh_token ?? credentials.refreshToken;
  const expiresIn = tokenData.expires_in ?? 3600;
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const newCredentials: OutlookCredentials = {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresAt: newExpiresAt,
  };

  const newEncrypted = encrypt(JSON.stringify(newCredentials));

  try {
    const db = getDb();
    db.prepare(
      `UPDATE integration_configs
       SET encrypted_credentials = ?, updated_at = ?
       WHERE id = ?`
    ).run(newEncrypted, new Date().toISOString(), config.id);
    saveDb();
  } catch (dbErr) {
    console.error('OutlookConnector: failed to persist refreshed tokens', dbErr);
  }

  return newAccessToken;
}

/**
 * Microsoft Graph message shape (partial).
 */
interface GraphMessage {
  id: string;
  subject: string | null;
  body: {
    content: string;
    contentType: string;
  };
  webLink: string;
  receivedDateTime: string;
}

export const OutlookConnector: Connector = {
  provider: 'outlook',

  async fetch(config: IntegrationConfig): Promise<IndexedDocument[]> {
    // 1. Decrypt credentials
    const credentialsJson = decrypt(config.encryptedCredentials);
    let credentials: OutlookCredentials = JSON.parse(credentialsJson);

    // 2. Check if token is expired; attempt refresh if so
    const isExpired = new Date(credentials.expiresAt) <= new Date();
    if (isExpired) {
      const newAccessToken = await refreshAccessToken(config, credentials);
      credentials = { ...credentials, accessToken: newAccessToken };
    }

    // 3. Build the messages URL (last 30 days, top 200)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const filter = `receivedDateTime ge ${thirtyDaysAgo}`;
    const select = 'subject,body,webLink,receivedDateTime';
    const messagesUrl =
      `https://graph.microsoft.com/v1.0/me/messages` +
      `?$filter=${encodeURIComponent(filter)}&$top=200&$select=${select}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${credentials.accessToken}`,
    };

    // 4. Fetch emails
    let response: Response;
    try {
      response = await fetch(messagesUrl, { headers });
    } catch (networkErr) {
      throw networkErr;
    }

    // 5. Handle HTTP 401 — attempt token refresh once
    if (response.status === 401) {
      const newAccessToken = await refreshAccessToken(config, credentials);
      credentials = { ...credentials, accessToken: newAccessToken };
      headers['Authorization'] = `Bearer ${credentials.accessToken}`;

      try {
        response = await fetch(messagesUrl, { headers });
      } catch (networkErr) {
        throw networkErr;
      }

      if (!response.ok) {
        markConfigError(config.id, 'Authentication failed after token refresh');
        throw new Error(
          `OutlookConnector: authentication failed after token refresh (HTTP ${response.status}) for config ${config.id}`
        );
      }
    } else if (!response.ok) {
      throw new Error(
        `OutlookConnector: unexpected HTTP ${response.status} for config ${config.id}`
      );
    }

    // 6. Parse response
    const data = await response.json() as { value: GraphMessage[] };
    const messages = data.value ?? [];

    // 7. Normalize each message to IndexedDocument, filtering empty ones
    const fetchedAt = new Date().toISOString();
    const documents: IndexedDocument[] = [];

    for (const message of messages) {
      const title = message.subject || '(no subject)';
      const rawBody = message.body?.content ?? '';
      const strippedBody = stripHtml(rawBody);

      // 5. Exclude emails where both subject and stripped body are empty/whitespace
      const subjectEmpty = !message.subject || !message.subject.trim();
      const bodyEmpty = !strippedBody || !strippedBody.trim();
      if (subjectEmpty && bodyEmpty) {
        continue;
      }

      documents.push({
        id: `${config.orgId}:outlook:${message.id}`,
        orgId: config.orgId,
        provider: 'outlook',
        sourceId: message.id,
        title,
        content: strippedBody,
        url: message.webLink,
        fetchedAt,
      } satisfies IndexedDocument);
    }

    return documents;
  },
};
