import { IndexedDocument, IntegrationConfig, IntegrationProvider } from '../../types';

export interface Connector {
  readonly provider: IntegrationProvider;
  fetch(config: IntegrationConfig): Promise<IndexedDocument[]>;
}
