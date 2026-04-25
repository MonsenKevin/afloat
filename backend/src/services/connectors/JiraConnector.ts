import { IndexedDocument, IntegrationConfig, JiraCredentials } from '../../types';
import { decrypt } from '../credentialStore';
import { getDb, saveDb } from '../../db';
import { Connector } from './types';

/**
 * Recursively extracts plain text from an Atlassian Document Format (ADF) node.
 * ADF is a JSON tree where leaf nodes of type "text" carry the actual string content.
 */
export function extractAdfText(adf: any): string {
  if (!adf || typeof adf !== 'object') {
    return '';
  }

  // Leaf text node
  if (adf.type === 'text' && typeof adf.text === 'string') {
    return adf.text;
  }

  // Recurse into content array
  if (Array.isArray(adf.content)) {
    return adf.content.map((node: any) => extractAdfText(node)).join('');
  }

  return '';
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
    console.error('JiraConnector: failed to update integration_configs error status', dbErr);
  }
}

/**
 * Fetches Jira issues with retry logic for HTTP 429 responses.
 * Retries up to maxRetries times, honouring the Retry-After header.
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

    const retryAfterHeader = response.headers.get('Retry-After');
    const waitSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
    const waitMs = isNaN(waitSeconds) ? 60_000 : waitSeconds * 1000;

    console.warn(
      `JiraConnector: rate limited (429). Waiting ${waitMs}ms before retry ${attempt}/${maxRetries - 1}.`
    );
    await sleep(waitMs);
  }
}

export const JiraConnector: Connector = {
  provider: 'jira',

  async fetch(config: IntegrationConfig): Promise<IndexedDocument[]> {
    // 1. Decrypt credentials
    const credentialsJson = decrypt(config.encryptedCredentials);
    const credentials: JiraCredentials = JSON.parse(credentialsJson);
    const { baseUrl, email, apiToken, projectKey } = credentials;

    // 2. Build Basic auth header
    const basicAuth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const headers: Record<string, string> = {
      Authorization: `Basic ${basicAuth}`,
      Accept: 'application/json',
    };

    // 3. Build Jira search URL
    const jql = `project%3D${encodeURIComponent(projectKey)}%20AND%20updated%3E%3D-90d%20ORDER%20BY%20updated%20DESC`;
    const fields = 'summary,description,comment,status';
    const searchUrl = `${baseUrl}/rest/api/3/search?jql=${jql}&maxResults=100&fields=${fields}`;

    // 4. Fetch with retry support
    let response: Response;
    try {
      response = await fetchWithRetry(searchUrl, headers);
    } catch (networkErr) {
      throw networkErr;
    }

    // 5. Handle error status codes
    if (response.status === 401 || response.status === 403) {
      markConfigError(config.id, 'Authentication failed');
      throw new Error(`JiraConnector: authentication failed (HTTP ${response.status}) for config ${config.id}`);
    }

    if (response.status === 429) {
      throw new Error(`JiraConnector: rate limit exceeded after max retries for config ${config.id}`);
    }

    if (!response.ok) {
      throw new Error(`JiraConnector: unexpected HTTP ${response.status} for config ${config.id}`);
    }

    // 6. Parse response
    const data = await response.json() as {
      issues: Array<{
        key: string;
        fields: {
          summary: string;
          description: any; // ADF object or null
          comment?: {
            comments?: Array<{
              body: any; // ADF object
            }>;
          };
          status?: {
            name: string;
          };
        };
      }>;
    };

    const issues = data.issues ?? [];

    // 7. Normalize each issue to IndexedDocument
    return issues.map(issue => {
      const title = issue.fields.summary || issue.key;

      // Extract description text from ADF
      let descriptionText = '';
      if (issue.fields.description) {
        descriptionText = extractAdfText(issue.fields.description).trim();
      }

      // Extract comment texts from ADF
      const commentTexts: string[] = [];
      const comments = issue.fields.comment?.comments ?? [];
      for (const comment of comments) {
        if (comment.body) {
          const commentText = extractAdfText(comment.body).trim();
          if (commentText) {
            commentTexts.push(commentText);
          }
        }
      }

      // Build content: description + comments, falling back to title if empty
      const parts: string[] = [];
      if (descriptionText) {
        parts.push(descriptionText);
      }
      if (commentTexts.length > 0) {
        parts.push(...commentTexts);
      }
      const content = parts.length > 0 ? parts.join('\n\n') : title;

      return {
        id: `${config.orgId}:jira:${issue.key}`,
        orgId: config.orgId,
        provider: 'jira',
        sourceId: issue.key,
        title,
        content,
        url: `${baseUrl}/browse/${issue.key}`,
        fetchedAt: new Date().toISOString(),
      } satisfies IndexedDocument;
    });
  },
};
