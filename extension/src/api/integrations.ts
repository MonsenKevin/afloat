import apiClient from './client';
import { IntegrationConfig, IntegrationProvider, IntegrationStatus } from '../types/index';

export async function listIntegrations(): Promise<IntegrationConfig[]> {
  const res = await apiClient.get<IntegrationConfig[]>('/api/integrations');
  return res.data;
}

export async function createIntegration(payload: {
  provider: IntegrationProvider;
  credentials?: Record<string, unknown>;
}): Promise<IntegrationConfig> {
  const res = await apiClient.post<IntegrationConfig>('/api/integrations', payload);
  return res.data;
}

export async function updateIntegration(
  id: string,
  payload: { credentials?: Record<string, unknown>; status?: IntegrationStatus }
): Promise<IntegrationConfig> {
  const res = await apiClient.patch<IntegrationConfig>(`/api/integrations/${id}`, payload);
  return res.data;
}

export async function deleteIntegration(id: string): Promise<{ success: boolean }> {
  const res = await apiClient.delete<{ success: boolean }>(`/api/integrations/${id}`);
  return res.data;
}

export async function getIntegrationStatus(id: string): Promise<{
  status: IntegrationStatus;
  lastSyncedAt: string | null;
  errorMessage: string | null;
}> {
  const res = await apiClient.get<{
    status: IntegrationStatus;
    lastSyncedAt: string | null;
    errorMessage: string | null;
  }>(`/api/integrations/${id}/status`);
  return res.data;
}

export async function triggerSync(id: string): Promise<{ message: string }> {
  const res = await apiClient.post<{ message: string }>(`/api/integrations/${id}/sync`);
  return res.data;
}

export async function startOAuth(
  provider: IntegrationProvider,
  configId: string
): Promise<{ url: string }> {
  const res = await apiClient.get<{ url: string }>(
    `/api/integrations/oauth/${provider}/start`,
    { params: { configId } }
  );
  return res.data;
}
