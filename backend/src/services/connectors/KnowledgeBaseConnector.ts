import { IndexedDocument, IntegrationConfig } from '../../types';
import { loadKbDocuments } from '../kbLoader';
import { Connector } from './types';

export const KnowledgeBaseConnector: Connector = {
  provider: 'knowledge_base',

  async fetch(config: IntegrationConfig): Promise<IndexedDocument[]> {
    try {
      const docs = loadKbDocuments();

      if (docs.length === 0) {
        return [];
      }

      return docs.map(doc => ({
        id: 'kb:' + doc.source + ':' + doc.section,
        orgId: config.orgId,
        provider: 'knowledge_base',
        sourceId: doc.source + ':' + doc.section,
        title: doc.title,
        content: doc.content,
        url: '',
        fetchedAt: new Date().toISOString(),
      }));
    } catch (err) {
      console.error('KnowledgeBaseConnector: failed to load KB documents', err);
      return [];
    }
  },
};
