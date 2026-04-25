import { getDb, saveDb } from '../db';
import { IntegrationConfig, IntegrationProvider } from '../types';
import { indexService } from './integrationIndex';
import { Connector } from './connectors/types';
import { JiraConnector } from './connectors/JiraConnector';
import { GitHubConnector } from './connectors/GitHubConnector';
import { OutlookConnector } from './connectors/OutlookConnector';
import { GoogleCalendarConnector } from './connectors/GoogleCalendarConnector';
import { GranolaConnector } from './connectors/GranolaConnector';
import { KnowledgeBaseConnector } from './connectors/KnowledgeBaseConnector';

const connectorMap: Record<IntegrationProvider, Connector> = {
  jira: JiraConnector,
  github: GitHubConnector,
  outlook: OutlookConnector,
  google_calendar: GoogleCalendarConnector,
  granola: GranolaConnector,
  knowledge_base: KnowledgeBaseConnector,
};

export class SyncScheduler {
  private timer: NodeJS.Timeout | null = null;
  private inProgress = new Set<string>(); // config IDs currently syncing

  start(): void {
    const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES ?? '60', 10);
    const intervalMs = (isNaN(intervalMinutes) ? 60 : intervalMinutes) * 60 * 1000;

    console.log(`SyncScheduler: starting with interval ${intervalMinutes} minutes`);

    this.timer = setInterval(() => {
      this.syncAll().catch(err => {
        console.error('SyncScheduler: syncAll error', err);
      });
    }, intervalMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('SyncScheduler: stopped');
    }
  }

  async syncOne(configId: string): Promise<void> {
    if (this.inProgress.has(configId)) {
      console.log(`SyncScheduler: sync already in progress for config ${configId}, skipping`);
      return;
    }

    this.inProgress.add(configId);

    try {
      const db = getDb();
      const row = db.prepare('SELECT * FROM integration_configs WHERE id = ?').get(configId);

      if (!row) {
        console.warn(`SyncScheduler: config ${configId} not found`);
        return;
      }

      const config: IntegrationConfig = {
        id: row.id as string,
        orgId: row.org_id as string,
        provider: row.provider as IntegrationProvider,
        status: row.status as IntegrationConfig['status'],
        encryptedCredentials: row.encrypted_credentials as string,
        lastSyncedAt: row.last_synced_at as string | null,
        errorMessage: row.error_message as string | null,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      };

      const connector = connectorMap[config.provider];
      const docs = await connector.fetch(config);

      await indexService.upsert(config.orgId, config.provider, docs);

      const now = new Date().toISOString();
      db.prepare(
        'UPDATE integration_configs SET last_synced_at = ?, updated_at = ? WHERE id = ?',
      ).run(now, now, configId);
      saveDb();

      console.log(`SyncScheduler: sync complete for config ${configId} (${docs.length} docs)`);
    } catch (err: any) {
      console.error(`SyncScheduler: sync failed for config ${configId}`, err);

      try {
        const db = getDb();
        const now = new Date().toISOString();
        db.prepare(
          "UPDATE integration_configs SET status = 'error', error_message = ?, updated_at = ? WHERE id = ?",
        ).run(err.message ?? 'Unknown error', now, configId);
        saveDb();
      } catch (dbErr) {
        console.error('SyncScheduler: failed to update error status', dbErr);
      }
    } finally {
      this.inProgress.delete(configId);
    }
  }

  private async syncAll(): Promise<void> {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM integration_configs WHERE status = 'active'").all();

    console.log(`SyncScheduler: syncAll found ${rows.length} active configs`);

    for (const row of rows) {
      // Fire-and-forget — don't await each one sequentially
      this.syncOne(row.id as string).catch(err => {
        console.error(`SyncScheduler: unhandled error in syncOne for ${row.id}`, err);
      });
    }
  }
}

export const syncScheduler = new SyncScheduler();
