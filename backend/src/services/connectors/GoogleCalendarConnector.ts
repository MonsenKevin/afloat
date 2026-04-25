import { GoogleCalendarCredentials, IndexedDocument, IntegrationConfig } from '../../types';
import { decrypt, encrypt } from '../credentialStore';
import { getDb, saveDb } from '../../db';
import { Connector } from './types';

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
    console.error('GoogleCalendarConnector: failed to update integration_configs error status', dbErr);
  }
}

/**
 * Attempts to refresh the OAuth access token using Google's token endpoint.
 * On success, updates the integration_configs row with new encrypted credentials.
 * On failure, marks the config as errored and throws.
 *
 * Returns the new access token on success.
 */
async function refreshAccessToken(
  config: IntegrationConfig,
  credentials: GoogleCalendarCredentials
): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: credentials.refreshToken,
    client_id: clientId ?? '',
    client_secret: clientSecret ?? '',
  });

  let refreshResponse: Response;
  try {
    refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch (networkErr) {
    markConfigError(config.id, 'OAuth token refresh failed');
    throw networkErr;
  }

  if (!refreshResponse.ok) {
    markConfigError(config.id, 'OAuth token refresh failed');
    throw new Error(
      `GoogleCalendarConnector: token refresh failed (HTTP ${refreshResponse.status}) for config ${config.id}`
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

  const newCredentials: GoogleCalendarCredentials = {
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
    console.error('GoogleCalendarConnector: failed to persist refreshed tokens', dbErr);
  }

  return newAccessToken;
}

/**
 * Google Calendar event shape (partial).
 */
interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  htmlLink: string;
  attendees?: Array<{
    displayName?: string;
    email: string;
  }>;
}

export const GoogleCalendarConnector: Connector = {
  provider: 'google_calendar',

  async fetch(config: IntegrationConfig): Promise<IndexedDocument[]> {
    // 1. Decrypt credentials
    const credentialsJson = decrypt(config.encryptedCredentials);
    let credentials: GoogleCalendarCredentials = JSON.parse(credentialsJson);

    // 2. Check if token is expired; attempt refresh if so
    const isExpired = new Date(credentials.expiresAt) <= new Date();
    if (isExpired) {
      const newAccessToken = await refreshAccessToken(config, credentials);
      credentials = { ...credentials, accessToken: newAccessToken };
    }

    // 3. Build the events URL
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const eventsUrl =
      `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
      `?timeMin=${encodeURIComponent(fourteenDaysAgo)}` +
      `&timeMax=${encodeURIComponent(thirtyDaysFromNow)}` +
      `&maxResults=500` +
      `&singleEvents=true` +
      `&orderBy=startTime`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${credentials.accessToken}`,
    };

    // 4. Fetch events
    let response: Response;
    try {
      response = await fetch(eventsUrl, { headers });
    } catch (networkErr) {
      throw networkErr;
    }

    // 5. Handle HTTP 401 — attempt token refresh once
    if (response.status === 401) {
      const newAccessToken = await refreshAccessToken(config, credentials);
      credentials = { ...credentials, accessToken: newAccessToken };
      headers['Authorization'] = `Bearer ${credentials.accessToken}`;

      try {
        response = await fetch(eventsUrl, { headers });
      } catch (networkErr) {
        throw networkErr;
      }

      if (!response.ok) {
        markConfigError(config.id, 'Authentication failed after token refresh');
        throw new Error(
          `GoogleCalendarConnector: authentication failed after token refresh (HTTP ${response.status}) for config ${config.id}`
        );
      }
    } else if (!response.ok) {
      throw new Error(
        `GoogleCalendarConnector: unexpected HTTP ${response.status} for config ${config.id}`
      );
    }

    // 6. Parse response
    const data = await response.json() as { items: GoogleCalendarEvent[] };
    const events = data.items ?? [];

    // 7. Normalize each event to IndexedDocument
    const fetchedAt = new Date().toISOString();
    const documents: IndexedDocument[] = [];

    for (const event of events) {
      // Exclude events with no summary AND no attendees
      const hasSummary = !!event.summary;
      const hasAttendees = !!(event.attendees && event.attendees.length > 0);
      if (!hasSummary && !hasAttendees) {
        continue;
      }

      const title = event.summary || '(no title)';
      const attendeeNames = event.attendees
        ?.map(a => a.displayName || a.email)
        .join(', ') ?? '';

      let content: string;
      if (event.description) {
        content = attendeeNames
          ? `${event.description}\n${attendeeNames}`
          : event.description;
      } else {
        content = attendeeNames
          ? `${title} ${attendeeNames}`
          : title;
      }

      documents.push({
        id: `${config.orgId}:google_calendar:${event.id}`,
        orgId: config.orgId,
        provider: 'google_calendar',
        sourceId: event.id,
        title,
        content,
        url: event.htmlLink,
        fetchedAt,
      } satisfies IndexedDocument);
    }

    return documents;
  },
};
