import React, { useEffect, useState } from 'react';
import {
  listIntegrations,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  startOAuth,
} from '../../api/integrations';
import { IntegrationConfig, IntegrationProvider } from '../../types/index';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatProvider(provider: IntegrationProvider): string {
  const map: Record<IntegrationProvider, string> = {
    jira: 'Jira',
    github: 'GitHub',
    outlook: 'Outlook',
    google_calendar: 'Google Calendar',
    granola: 'Granola',
    knowledge_base: 'Knowledge Base',
  };
  return map[provider] ?? provider;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: IntegrationConfig['status'] }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    active:   { bg: '#dcfce7', color: '#15803d', label: 'Active' },
    disabled: { bg: '#f3f4f6', color: '#6b7280', label: 'Disabled' },
    error:    { bg: '#fee2e2', color: '#dc2626', label: 'Error' },
  };
  const s = styles[status] ?? styles.disabled;
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700,
      padding: '2px 8px', borderRadius: 12,
    }}>
      {s.label}
    </span>
  );
}

// ─── Integration Card ────────────────────────────────────────────────────────

interface CardProps {
  config: IntegrationConfig;
  onEnable: (id: string) => void;
  onDisable: (id: string) => void;
  onDelete: (id: string) => void;
  actionLoading: string | null;
}

function IntegrationCard({ config, onEnable, onDisable, onDelete, actionLoading }: CardProps) {
  const busy = actionLoading === config.id;
  return (
    <div style={{
      border: '1px solid #f3f4f6',
      borderRadius: 10,
      padding: '14px 16px',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>
            {formatProvider(config.provider)}
          </span>
          <StatusBadge status={config.status} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {config.status === 'disabled' || config.status === 'error' ? (
            <button
              onClick={() => onEnable(config.id)}
              disabled={busy}
              style={btnStyle('#f97316', '#fff')}
            >
              Enable
            </button>
          ) : (
            <button
              onClick={() => onDisable(config.id)}
              disabled={busy}
              style={btnStyle('#f3f4f6', '#374151')}
            >
              Disable
            </button>
          )}
          <button
            onClick={() => onDelete(config.id)}
            disabled={busy}
            style={btnStyle('#fee2e2', '#dc2626')}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Last synced */}
      <div style={{ fontSize: 12, color: '#6b7280' }}>
        Last synced: <span style={{ color: '#374151' }}>{formatDate(config.lastSyncedAt)}</span>
      </div>

      {/* Error message */}
      {config.status === 'error' && config.errorMessage && (
        <div style={{
          fontSize: 12, color: '#dc2626',
          background: '#fff1f2', borderRadius: 6,
          padding: '6px 10px', marginTop: 2,
        }}>
          {config.errorMessage}
        </div>
      )}
    </div>
  );
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg, color, border: 'none', borderRadius: 6,
    padding: '4px 10px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
  };
}

// ─── Provider-specific credential fields ─────────────────────────────────────

type CredentialFields = Record<string, string>;

interface FieldErrors {
  [key: string]: string;
}

interface ProviderFormProps {
  provider: IntegrationProvider;
  fields: CredentialFields;
  errors: FieldErrors;
  onChange: (key: string, value: string) => void;
  onOAuth: () => void;
}

function ProviderFields({ provider, fields, errors, onChange, onOAuth }: ProviderFormProps) {
  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%', padding: '7px 10px', fontSize: 13,
    border: `1px solid ${hasError ? '#dc2626' : '#e5e7eb'}`,
    borderRadius: 6, outline: 'none', boxSizing: 'border-box',
    color: '#111827',
  });

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 2, display: 'block',
  };

  const errorStyle: React.CSSProperties = {
    fontSize: 11, color: '#dc2626', marginTop: 2,
  };

  const field = (key: string, label: string, placeholder?: string, type = 'text') => (
    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        placeholder={placeholder ?? label}
        value={fields[key] ?? ''}
        onChange={e => onChange(key, e.target.value)}
        style={inputStyle(!!errors[key])}
      />
      {errors[key] && <span style={errorStyle}>{errors[key]}</span>}
    </div>
  );

  switch (provider) {
    case 'jira':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {field('baseUrl', 'Base URL', 'https://yourorg.atlassian.net')}
          {field('email', 'Email', 'you@example.com', 'email')}
          {field('apiToken', 'API Token', 'Your Jira API token')}
          {field('projectKey', 'Project Key', 'e.g. ENG')}
        </div>
      );

    case 'github':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {field('token', 'Personal Access Token', 'ghp_...')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={labelStyle}>Repositories (one per line)</label>
            <textarea
              placeholder={'owner/repo\nowner/another-repo'}
              value={fields['repos'] ?? ''}
              onChange={e => onChange('repos', e.target.value)}
              rows={3}
              style={{
                ...inputStyle(!!errors['repos']),
                resize: 'vertical', fontFamily: 'inherit',
              }}
            />
            {errors['repos'] && <span style={errorStyle}>{errors['repos']}</span>}
          </div>
        </div>
      );

    case 'granola':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {field('apiKey', 'API Key', 'Your Granola API key')}
        </div>
      );

    case 'outlook':
    case 'google_calendar':
      return (
        <div>
          <button
            type="button"
            onClick={onOAuth}
            style={{
              background: '#38bdf8', color: '#fff', border: 'none',
              borderRadius: 6, padding: '8px 16px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Connect with OAuth
          </button>
        </div>
      );

    case 'knowledge_base':
      return null;

    default:
      return null;
  }
}

// ─── Add Integration Form ─────────────────────────────────────────────────────

const ALL_PROVIDERS: IntegrationProvider[] = [
  'jira', 'github', 'granola', 'outlook', 'google_calendar', 'knowledge_base',
];

const REQUIRED_FIELDS: Partial<Record<IntegrationProvider, string[]>> = {
  jira: ['baseUrl', 'email', 'apiToken', 'projectKey'],
  github: ['token', 'repos'],
  granola: ['apiKey'],
};

interface AddFormProps {
  onCreated: (config: IntegrationConfig) => void;
}

function AddIntegrationForm({ onCreated }: AddFormProps) {
  const [provider, setProvider] = useState<IntegrationProvider>('jira');
  const [fields, setFields] = useState<CredentialFields>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFieldChange = (key: string, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleProviderChange = (p: IntegrationProvider) => {
    setProvider(p);
    setFields({});
    setErrors({});
    setSubmitError(null);
  };

  const validate = (): boolean => {
    const required = REQUIRED_FIELDS[provider] ?? [];
    const newErrors: FieldErrors = {};
    for (const key of required) {
      const val = (fields[key] ?? '').trim();
      if (!val) newErrors[key] = 'This field is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      let credentials: Record<string, unknown> = {};

      if (provider === 'github') {
        const repos = (fields['repos'] ?? '')
          .split('\n')
          .map(r => r.trim())
          .filter(Boolean);
        credentials = { token: fields['token'], repos };
      } else if (provider === 'knowledge_base') {
        credentials = {};
      } else {
        credentials = Object.fromEntries(
          Object.entries(fields).map(([k, v]) => [k, v.trim()])
        );
      }

      const created = await createIntegration({ provider, credentials });
      onCreated(created);
      setFields({});
      setErrors({});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create integration';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuth = async () => {
    try {
      // Create a placeholder config first, then start OAuth
      const created = await createIntegration({ provider, credentials: {} });
      const { url } = await startOAuth(provider, created.id);
      chrome.tabs.create({ url });
      onCreated(created);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'OAuth failed';
      setSubmitError(msg);
    }
  };

  const isOAuth = provider === 'outlook' || provider === 'google_calendar';
  const isKB = provider === 'knowledge_base';

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Provider selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Provider</label>
        <select
          value={provider}
          onChange={e => handleProviderChange(e.target.value as IntegrationProvider)}
          style={{
            padding: '7px 10px', fontSize: 13, border: '1px solid #e5e7eb',
            borderRadius: 6, color: '#111827', background: '#fff',
          }}
        >
          {ALL_PROVIDERS.map(p => (
            <option key={p} value={p}>{formatProvider(p)}</option>
          ))}
        </select>
      </div>

      {/* Credential fields */}
      <ProviderFields
        provider={provider}
        fields={fields}
        errors={errors}
        onChange={handleFieldChange}
        onOAuth={handleOAuth}
      />

      {/* Submit error */}
      {submitError && (
        <div style={{ fontSize: 12, color: '#dc2626', background: '#fff1f2', borderRadius: 6, padding: '6px 10px' }}>
          {submitError}
        </div>
      )}

      {/* Submit button — not shown for OAuth providers */}
      {!isOAuth && (
        <button
          type="submit"
          disabled={submitting}
          style={{
            background: '#f97316', color: '#fff', border: 'none',
            borderRadius: 6, padding: '8px 16px', fontSize: 13,
            fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1, alignSelf: 'flex-start',
          }}
        >
          {submitting ? 'Adding…' : isKB ? 'Add Knowledge Base' : 'Add Integration'}
        </button>
      )}
    </form>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function IntegrationDashboard() {
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await listIntegrations();
        setIntegrations(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load integrations';
        setLoadError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleEnable = async (id: string) => {
    setActionLoading(id);
    try {
      const updated = await updateIntegration(id, { status: 'active' });
      setIntegrations(prev => prev.map(i => i.id === id ? updated : i));
    } catch {
      // silently ignore — user can retry
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisable = async (id: string) => {
    setActionLoading(id);
    try {
      const updated = await updateIntegration(id, { status: 'disabled' });
      setIntegrations(prev => prev.map(i => i.id === id ? updated : i));
    } catch {
      // silently ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Delete this integration? This cannot be undone.');
    if (!confirmed) return;
    setActionLoading(id);
    try {
      await deleteIntegration(id);
      setIntegrations(prev => prev.filter(i => i.id !== id));
    } catch {
      // silently ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreated = (config: IntegrationConfig) => {
    setIntegrations(prev => [...prev, config]);
    setShowAddForm(false);
  };

  return (
    <div style={{
      flex: 1, overflowY: 'auto', padding: '16px',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
            Integrations
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
            Manage data sources for your organisation's AI assistant.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          style={{
            background: showAddForm ? '#f3f4f6' : '#f97316',
            color: showAddForm ? '#374151' : '#fff',
            border: 'none', borderRadius: 7,
            padding: '7px 14px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showAddForm ? 'Cancel' : '+ Add Integration'}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div style={{
          border: '1px solid #f3f4f6', borderRadius: 10,
          padding: '16px', background: '#fafafa',
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#111827' }}>
            Add Integration
          </h3>
          <AddIntegrationForm onCreated={handleCreated} />
        </div>
      )}

      {/* Loading / error states */}
      {loading && (
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '24px 0' }}>
          Loading integrations…
        </div>
      )}

      {!loading && loadError && (
        <div style={{
          background: '#fff1f2', border: '1px solid #fecaca',
          borderRadius: 8, padding: '12px 14px', color: '#dc2626', fontSize: 13,
        }}>
          {loadError}
        </div>
      )}

      {/* Integration list */}
      {!loading && !loadError && integrations.length === 0 && (
        <div style={{
          textAlign: 'center', color: '#9ca3af', fontSize: 13,
          padding: '32px 0', border: '1px dashed #e5e7eb', borderRadius: 10,
        }}>
          No integrations configured yet. Add one above.
        </div>
      )}

      {!loading && integrations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {integrations.map(config => (
            <IntegrationCard
              key={config.id}
              config={config}
              onEnable={handleEnable}
              onDisable={handleDisable}
              onDelete={handleDelete}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
