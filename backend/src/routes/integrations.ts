import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { getDb, saveDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';
import { encrypt } from '../services/credentialStore';
import { indexService } from '../services/integrationIndex';
import { syncScheduler } from '../services/syncScheduler';
import { IntegrationProvider } from '../types';

const router = Router();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_PROVIDERS: IntegrationProvider[] = [
  'jira',
  'github',
  'outlook',
  'google_calendar',
  'granola',
  'knowledge_base',
];

const REQUIRED_CREDENTIAL_FIELDS: Record<IntegrationProvider, string[]> = {
  jira: ['baseUrl', 'email', 'apiToken', 'projectKey'],
  github: ['token', 'repos'],
  outlook: [],           // OAuth only
  google_calendar: [],   // OAuth only
  granola: ['apiKey'],
  knowledge_base: [],    // no credentials required
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskRow(row: any) {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    provider: row.provider as IntegrationProvider,
    status: row.status as string,
    credentials: '••••••••',
    lastSyncedAt: row.last_synced_at as string | null,
    errorMessage: row.error_message as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// OAuth routes — registered BEFORE the blanket requireAuth + requireManager
// middleware so the callback route (no auth) is reachable by the browser tab.
// ---------------------------------------------------------------------------

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';

// GET /api/integrations/oauth/:provider/start?configId=
// Requires auth + manager (applied inline).
router.get(
  '/oauth/:provider/start',
  requireAuth,
  requireManager,
  (req: Request, res: Response) => {
    try {
      const db = getDb();
      const { provider } = req.params;
      const { configId } = req.query as { configId?: string };

      if (!configId) {
        return res.status(400).json({ error: 'configId query parameter is required' });
      }

      if (provider !== 'outlook' && provider !== 'google_calendar') {
        return res.status(400).json({ error: `OAuth is not supported for provider: ${provider}` });
      }

      // Generate CSRF nonce
      const nonce = randomBytes(16).toString('hex');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 minutes
      const createdAt = now.toISOString();

      db.prepare(
        'INSERT INTO oauth_states (nonce, config_id, provider, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(nonce, configId, provider, expiresAt, createdAt);
      saveDb();

      const state = `${nonce}:${configId}`;
      let url: string;

      if (provider === 'outlook') {
        const clientId = process.env.OUTLOOK_CLIENT_ID ?? '';
        const redirectUri = encodeURIComponent(`${BACKEND_URL}/api/integrations/oauth/outlook/callback`);
        url =
          `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
          `?client_id=${clientId}` +
          `&response_type=code` +
          `&redirect_uri=${redirectUri}` +
          `&scope=offline_access%20Mail.Read` +
          `&state=${encodeURIComponent(state)}`;
      } else {
        // google_calendar
        const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
        const redirectUri = encodeURIComponent(`${BACKEND_URL}/api/integrations/oauth/google_calendar/callback`);
        url =
          `https://accounts.google.com/o/oauth2/v2/auth` +
          `?client_id=${clientId}` +
          `&response_type=code` +
          `&redirect_uri=${redirectUri}` +
          `&scope=https://www.googleapis.com/auth/calendar.readonly` +
          `&access_type=offline` +
          `&state=${encodeURIComponent(state)}`;
      }

      return res.json({ url });
    } catch (err) {
      console.error('GET /api/integrations/oauth/:provider/start error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// GET /api/integrations/oauth/:provider/callback?code=&state=
// NO auth middleware — this is opened in a browser tab by the OAuth provider.
router.get('/oauth/:provider/callback', async (req: Request, res: Response) => {
  const htmlClose = `<html><body><script>window.close()</script><p>Connected! You can close this tab.</p></body></html>`;
  const htmlError = (message: string) =>
    `<html><body><p>Error: ${message}. Please close this tab and try again.</p></body></html>`;

  try {
    const db = getDb();
    const { provider } = req.params;
    const { code, state } = req.query as { code?: string; state?: string };

    if (!code || !state) {
      return res.status(400).send(htmlError('Missing code or state parameter'));
    }

    // Parse state as {nonce}:{configId} — split on first ':' only
    const colonIndex = state.indexOf(':');
    if (colonIndex === -1) {
      return res.status(400).send(htmlError('Invalid state parameter'));
    }
    const nonce = state.slice(0, colonIndex);
    const configId = state.slice(colonIndex + 1);

    // Look up and validate nonce
    const oauthState = db
      .prepare('SELECT nonce, config_id, provider, expires_at FROM oauth_states WHERE nonce = ?')
      .get(nonce) as { nonce: string; config_id: string; provider: string; expires_at: string } | undefined;

    if (!oauthState) {
      return res.status(400).send(htmlError('Invalid or expired OAuth state'));
    }

    if (new Date(oauthState.expires_at) <= new Date()) {
      db.prepare('DELETE FROM oauth_states WHERE nonce = ?').run(nonce);
      saveDb();
      return res.status(400).send(htmlError('OAuth state has expired'));
    }

    // Delete nonce after use (one-time use)
    db.prepare('DELETE FROM oauth_states WHERE nonce = ?').run(nonce);
    saveDb();

    // Exchange code for tokens
    let tokenUrl: string;
    let tokenBody: Record<string, string>;

    if (provider === 'outlook') {
      tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      tokenBody = {
        grant_type: 'authorization_code',
        code,
        client_id: process.env.OUTLOOK_CLIENT_ID ?? '',
        client_secret: process.env.OUTLOOK_CLIENT_SECRET ?? '',
        redirect_uri: `${BACKEND_URL}/api/integrations/oauth/outlook/callback`,
      };
    } else if (provider === 'google_calendar') {
      tokenUrl = 'https://oauth2.googleapis.com/token';
      tokenBody = {
        grant_type: 'authorization_code',
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: `${BACKEND_URL}/api/integrations/oauth/google_calendar/callback`,
      };
    } else {
      return res.status(400).send(htmlError(`OAuth is not supported for provider: ${provider}`));
    }

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(tokenBody).toString(),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error(`OAuth token exchange failed for ${provider}:`, errText);
      return res.status(400).send(htmlError('Token exchange failed'));
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const expiresAt = new Date(
      Date.now() + (tokenData.expires_in ?? 3600) * 1000,
    ).toISOString();

    const credentials = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? '',
      expiresAt,
    };

    const encryptedCredentials = encrypt(JSON.stringify(credentials));
    const now = new Date().toISOString();

    db.prepare(
      'UPDATE integration_configs SET encrypted_credentials = ?, updated_at = ? WHERE id = ?',
    ).run(encryptedCredentials, now, configId);
    saveDb();

    return res.send(htmlClose);
  } catch (err: any) {
    console.error('GET /api/integrations/oauth/:provider/callback error:', err);
    return res.status(500).send(
      `<html><body><p>Error: ${err?.message ?? 'Internal server error'}. Please close this tab and try again.</p></body></html>`,
    );
  }
});

// ---------------------------------------------------------------------------
// All routes require auth + manager role (OAuth callback is handled separately)
// ---------------------------------------------------------------------------

router.use(requireAuth, requireManager);

// ---------------------------------------------------------------------------
// GET /api/integrations — list all configs for the org
// ---------------------------------------------------------------------------

router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const orgId = req.user!.orgId;

    const rows = db.prepare(
      'SELECT * FROM integration_configs WHERE org_id = ?',
    ).all(orgId);

    return res.json(rows.map(maskRow));
  } catch (err) {
    console.error('GET /api/integrations error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/integrations — create new config
// ---------------------------------------------------------------------------

router.post('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const orgId = req.user!.orgId;
    const { provider, credentials } = req.body;

    // Validate provider
    if (!VALID_PROVIDERS.includes(provider)) {
      return res.status(400).json({
        error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}`,
      });
    }

    // Validate required credential fields
    const requiredFields = REQUIRED_CREDENTIAL_FIELDS[provider as IntegrationProvider];
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      const value = credentials?.[field];
      if (field === 'repos') {
        // repos must be a non-empty array
        if (!Array.isArray(value) || value.length === 0) {
          missingFields.push(field);
        }
      } else {
        if (!value || typeof value !== 'string' || value.trim() === '') {
          missingFields.push(field);
        }
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Missing required credential fields: ${missingFields.join(', ')}`,
      });
    }

    // Encrypt credentials
    const credentialsJson = JSON.stringify(credentials ?? {});
    const encryptedCredentials = encrypt(credentialsJson);

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO integration_configs
        (id, org_id, provider, status, encrypted_credentials, last_synced_at, error_message, created_at, updated_at)
       VALUES (?, ?, ?, 'disabled', ?, NULL, NULL, ?, ?)`,
    ).run(id, orgId, provider, encryptedCredentials, now, now);

    saveDb();

    const created = db.prepare('SELECT * FROM integration_configs WHERE id = ?').get(id);
    return res.status(201).json(maskRow(created));
  } catch (err) {
    console.error('POST /api/integrations error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/integrations/:id — update config
// ---------------------------------------------------------------------------

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const orgId = req.user!.orgId;
    const { id } = req.params;

    // Verify config belongs to this org
    const existing = db.prepare(
      'SELECT * FROM integration_configs WHERE id = ? AND org_id = ?',
    ).get(id, orgId) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Integration config not found' });
    }

    const { credentials, status } = req.body;
    const now = new Date().toISOString();

    // Update credentials if provided
    if (credentials !== undefined) {
      const credentialsJson = JSON.stringify(credentials);
      const encryptedCredentials = encrypt(credentialsJson);
      db.prepare(
        'UPDATE integration_configs SET encrypted_credentials = ?, updated_at = ? WHERE id = ?',
      ).run(encryptedCredentials, now, id);
    }

    // Update status if provided
    if (status !== undefined) {
      db.prepare(
        'UPDATE integration_configs SET status = ?, updated_at = ? WHERE id = ?',
      ).run(status, now, id);

      if (status === 'active') {
        // Fire-and-forget sync
        syncScheduler.syncOne(id).catch(err => {
          console.error(`PATCH /api/integrations/${id}: syncOne error`, err);
        });
      } else if (status === 'disabled') {
        // Remove indexed documents for this provider
        indexService.remove(orgId, existing.provider as IntegrationProvider).catch(err => {
          console.error(`PATCH /api/integrations/${id}: indexService.remove error`, err);
        });
      }
    }

    // If neither credentials nor status was updated, still bump updated_at
    if (credentials === undefined && status === undefined) {
      db.prepare(
        'UPDATE integration_configs SET updated_at = ? WHERE id = ?',
      ).run(now, id);
    }

    saveDb();

    const updated = db.prepare('SELECT * FROM integration_configs WHERE id = ?').get(id);
    return res.json(maskRow(updated));
  } catch (err) {
    console.error('PATCH /api/integrations/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/integrations/:id — delete config
// ---------------------------------------------------------------------------

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const orgId = req.user!.orgId;
    const { id } = req.params;

    // Verify config belongs to this org
    const existing = db.prepare(
      'SELECT * FROM integration_configs WHERE id = ? AND org_id = ?',
    ).get(id, orgId) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Integration config not found' });
    }

    db.prepare('DELETE FROM integration_configs WHERE id = ?').run(id);
    saveDb();

    // Remove indexed documents for this provider
    await indexService.remove(orgId, existing.provider as IntegrationProvider);

    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/integrations/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/integrations/:id/status — get status
// ---------------------------------------------------------------------------

router.get('/:id/status', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const orgId = req.user!.orgId;
    const { id } = req.params;

    const row = db.prepare(
      'SELECT status, last_synced_at, error_message FROM integration_configs WHERE id = ? AND org_id = ?',
    ).get(id, orgId) as any;

    if (!row) {
      return res.status(404).json({ error: 'Integration config not found' });
    }

    return res.json({
      status: row.status,
      lastSyncedAt: row.last_synced_at,
      errorMessage: row.error_message,
    });
  } catch (err) {
    console.error('GET /api/integrations/:id/status error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/integrations/:id/sync — trigger immediate sync
// ---------------------------------------------------------------------------

router.post('/:id/sync', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const orgId = req.user!.orgId;
    const { id } = req.params;

    // Verify config belongs to this org
    const existing = db.prepare(
      'SELECT id FROM integration_configs WHERE id = ? AND org_id = ?',
    ).get(id, orgId);

    if (!existing) {
      return res.status(404).json({ error: 'Integration config not found' });
    }

    // Fire-and-forget
    syncScheduler.syncOne(id).catch(err => {
      console.error(`POST /api/integrations/${id}/sync: syncOne error`, err);
    });

    return res.json({ message: 'Sync triggered' });
  } catch (err) {
    console.error('POST /api/integrations/:id/sync error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
