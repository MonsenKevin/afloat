/**
 * Database migrations for the org-integrations feature.
 *
 * Each migration is tracked in the `schema_migrations` table so it only
 * runs once.  Migrations are idempotent: re-running the file is safe.
 *
 * Run with: npx ts-node src/db/migrate.ts
 */

import { getDb, saveDb } from './index';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function ensureMigrationsTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
}

function hasRun(migrationId: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT id FROM schema_migrations WHERE id = ?').get(migrationId);
  return row !== undefined;
}

function markRun(migrationId: string): void {
  const db = getDb();
  db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(
    migrationId,
    new Date().toISOString(),
  );
}

// ---------------------------------------------------------------------------
// individual migrations
// ---------------------------------------------------------------------------

function migration001AddOrgId(): void {
  if (hasRun('001_add_org_id')) return;

  const db = getDb();
  try {
    db.exec(`ALTER TABLE users ADD COLUMN org_id TEXT NOT NULL DEFAULT 'default'`);
    console.log('Migration 001_add_org_id: added org_id column to users.');
  } catch (err: any) {
    // Column already exists — this is fine, treat as a no-op.
    if (
      err?.message?.includes('duplicate column name') ||
      err?.message?.includes('already exists')
    ) {
      console.log('Migration 001_add_org_id: org_id column already exists, skipping ALTER.');
    } else {
      throw err;
    }
  }

  markRun('001_add_org_id');
  saveDb();
}

function migration002IntegrationTables(): void {
  if (hasRun('002_integration_tables')) return;

  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS integration_configs (
      id                    TEXT PRIMARY KEY,
      org_id                TEXT NOT NULL,
      provider              TEXT NOT NULL CHECK(provider IN ('jira','github','outlook','google_calendar','granola','knowledge_base')),
      status                TEXT NOT NULL DEFAULT 'disabled' CHECK(status IN ('active','disabled','error')),
      encrypted_credentials TEXT NOT NULL DEFAULT '',
      last_synced_at        TEXT,
      error_message         TEXT,
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_integration_configs_org ON integration_configs(org_id);

    CREATE TABLE IF NOT EXISTS indexed_documents (
      id         TEXT PRIMARY KEY,
      org_id     TEXT NOT NULL,
      provider   TEXT NOT NULL,
      source_id  TEXT NOT NULL,
      title      TEXT NOT NULL,
      content    TEXT NOT NULL,
      url        TEXT NOT NULL DEFAULT '',
      fetched_at TEXT NOT NULL,
      UNIQUE(org_id, provider, source_id)
    );

    CREATE INDEX IF NOT EXISTS idx_indexed_documents_org_provider ON indexed_documents(org_id, provider);
  `);

  console.log('Migration 002_integration_tables: created integration_configs and indexed_documents tables.');
  markRun('002_integration_tables');
  saveDb();
}

function migration003OauthStates(): void {
  if (hasRun('003_oauth_states')) return;

  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_states (
      nonce      TEXT PRIMARY KEY,
      config_id  TEXT NOT NULL,
      provider   TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  console.log('Migration 003_oauth_states: created oauth_states table.');
  markRun('003_oauth_states');
  saveDb();
}

// ---------------------------------------------------------------------------
// public entry point
// ---------------------------------------------------------------------------

export function runMigrations(): void {
  ensureMigrationsTable();
  migration001AddOrgId();
  migration002IntegrationTables();
  migration003OauthStates();
  console.log('All migrations complete.');
}

// Allow running directly: npx ts-node src/db/migrate.ts
if (require.main === module) {
  // When run standalone the DB must be initialised first.
  import('./index').then(({ initDb }) =>
    initDb().then(() => {
      runMigrations();
    }),
  );
}
