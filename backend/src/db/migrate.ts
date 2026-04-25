/**
 * One-time migration: update any peer_reviews rows with status = 'delivered'
 * to status = 'approved'. All other field values (responses, manager_notes,
 * completed_at, approved_at) are preserved — this is a status-only update.
 *
 * Run with: npx ts-node src/db/migrate.ts
 */

import { getDb, saveDb } from './index';

export function runMigration() {
  const db = getDb();

  const result = db
    .prepare(`UPDATE peer_reviews SET status = 'approved' WHERE status = 'delivered'`)
    .run();

  if (result.changes > 0) {
    console.log(`Migration: updated ${result.changes} peer_review(s) from 'delivered' to 'approved'.`);
    saveDb();
  } else {
    console.log('Migration: no peer_reviews with status = \'delivered\' found. Nothing to update.');
  }
}

// Allow running directly: npx ts-node src/db/migrate.ts
if (require.main === module) {
  runMigration();
}
