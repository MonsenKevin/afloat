import { getDb, saveDb } from '../db';
import { IndexedDocument, IntegrationProvider } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class IntegrationIndexService {
  private cache = new Map<string, IndexedDocument[]>();

  /**
   * Upsert documents for a (orgId, provider) pair.
   * Replaces ALL existing docs for that pair, then inserts the new ones.
   */
  async upsert(orgId: string, provider: IntegrationProvider, docs: IndexedDocument[]): Promise<void> {
    const db = getDb();

    // Delete all existing docs for this (orgId, provider) pair
    db.prepare('DELETE FROM indexed_documents WHERE org_id = ? AND provider = ?').run(orgId, provider);

    // Bulk-insert each new doc
    const insertStmt = db.prepare(
      'INSERT OR REPLACE INTO indexed_documents (id, org_id, provider, source_id, title, content, url, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );
    for (const doc of docs) {
      insertStmt.run(
        doc.id || uuidv4(),
        orgId,
        provider,
        doc.sourceId,
        doc.title,
        doc.content,
        doc.url,
        doc.fetchedAt,
      );
    }

    this.invalidate(orgId);
    saveDb();
  }

  /**
   * Remove all documents for a (orgId, provider) pair.
   * Called when an integration config is deleted or disabled.
   */
  async remove(orgId: string, provider: IntegrationProvider): Promise<void> {
    const db = getDb();
    db.prepare('DELETE FROM indexed_documents WHERE org_id = ? AND provider = ?').run(orgId, provider);
    this.invalidate(orgId);
    saveDb();
  }

  /**
   * Return all active documents for an org.
   * Checks in-memory cache first; on miss loads from SQLite and populates cache.
   */
  async getAll(orgId: string): Promise<IndexedDocument[]> {
    const cached = this.cache.get(orgId);
    if (cached !== undefined) {
      return cached;
    }

    const db = getDb();
    const rows = db.prepare('SELECT * FROM indexed_documents WHERE org_id = ?').all(orgId);

    const docs: IndexedDocument[] = rows.map((row: any) => ({
      id: row.id as string,
      orgId: row.org_id as string,
      provider: row.provider as IntegrationProvider,
      sourceId: row.source_id as string,
      title: row.title as string,
      content: row.content as string,
      url: row.url as string,
      fetchedAt: row.fetched_at as string,
    }));

    this.cache.set(orgId, docs);
    return docs;
  }

  /**
   * Invalidate the in-memory cache for an org.
   */
  invalidate(orgId: string): void {
    this.cache.delete(orgId);
  }
}

export const indexService = new IntegrationIndexService();
