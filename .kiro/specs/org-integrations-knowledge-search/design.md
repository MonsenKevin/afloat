# Design Document: Org Integrations & Knowledge Search

## Overview

This feature extends Mission Control's AI assistant to search across multiple external knowledge sources — Jira, GitHub, Outlook, Google Calendar, Granola, and the existing static knowledge base — when answering employee queries. Org admins (Managers) configure which integrations are active and supply credentials. The system fetches, normalizes, and indexes documents from each active source, then includes them in the context passed to Claude when answering questions.

The design extends the existing `queryKB` / `vectorStore` pipeline rather than replacing it. The existing `kbLoader` service is wrapped by a new `KnowledgeBaseConnector`, and the `queryKB` function is extended to accept `IndexedDocument` objects alongside the existing `KbDoc` objects. The existing `github.ts` service (blame contacts) is untouched.

### Key Design Decisions

1. **Org scoping via `manager_id` hierarchy**: The `users` table has no `org_id` column and the seed data must be preserved. Org identity is derived from the manager hierarchy: all users who share the same root manager (or are themselves a root manager) belong to the same implicit org. A new `org_id` column is added to `users` as a nullable TEXT field, populated during integration setup. For the existing seed data, all 16 users are treated as belonging to a single implicit org (`org_id = 'default'`). The seed script is not modified; a migration adds the column with a default value.

2. **OAuth flow via browser tab**: The Chrome extension cannot handle OAuth redirects. The backend exposes `/api/integrations/oauth/:provider/start` which returns a URL the extension opens in a new tab. The OAuth callback lands on the backend, stores the token, and closes the tab.

3. **Granola API**: Granola is treated as a real API with API key authentication. The connector is implemented with a clear interface and a stub implementation that can be swapped for a real HTTP client when the API is available.

4. **Index persistence in SQLite**: `IndexedDocument` records are stored in a new `indexed_documents` table in the existing SQLite database. An in-memory `Map<string, IndexedDocument[]>` cache is maintained per org and invalidated on sync completion or document deletion.

5. **Credential encryption**: AES-256-GCM with a key derived from the `ENCRYPTION_KEY` environment variable (32-byte hex string). The Node.js built-in `crypto` module is used — no new dependencies.

6. **KB Connector wraps existing `kbLoader`**: The `KnowledgeBaseConnector` calls `loadKbDocuments()` and converts each `KbDoc` to an `IndexedDocument`. The existing `setKbDocuments` / `getKbDocuments` in-memory store continues to work for the existing `queryKB` path.

---

## Architecture

```mermaid
graph TD
    subgraph Chrome Extension
        Chat[Chat Component]
        IntDash[Integration Dashboard]
        OAuthTab[OAuth Browser Tab]
    end

    subgraph Backend API
        KBRoute[POST /api/kb/ask]
        IntRoute[/api/integrations/*]
        OAuthRoute[/api/integrations/oauth/*]
    end

    subgraph Services
        VectorStore[vectorStore.ts\nqueryKB - extended]
        IndexService[integrationIndex.ts\nIndexService]
        SyncScheduler[syncScheduler.ts]
        CredStore[credentialStore.ts\nAES-256-GCM]
    end

    subgraph Connectors
        KBConn[KnowledgeBaseConnector\nwraps kbLoader]
        JiraConn[JiraConnector]
        GHConn[GitHubConnector]
        OutlookConn[OutlookConnector]
        GCalConn[GoogleCalendarConnector]
        GranolaConn[GranolaConnector]
    end

    subgraph Storage
        SQLite[(SQLite\nindexed_documents\nintegration_configs)]
        MemCache[In-Memory Cache\nMap orgId → IndexedDocument[]]
    end

    Chat -->|POST /api/kb/ask| KBRoute
    KBRoute --> VectorStore
    VectorStore --> IndexService
    IndexService --> MemCache
    MemCache -->|miss| SQLite

    IntDash -->|CRUD| IntRoute
    IntDash -->|open tab| OAuthTab
    OAuthTab -->|redirect| OAuthRoute
    OAuthRoute --> CredStore
    CredStore --> SQLite

    SyncScheduler -->|per active config| Connectors
    Connectors -->|IndexedDocument[]| IndexService
    IndexService --> SQLite

    KBConn --> kbLoader[kbLoader.ts\nexisting]
```

### Data Flow: Query

1. Extension sends `POST /api/kb/ask` with `{ question, history }`.
2. `kb.ts` route extracts `req.user.id`, looks up the user's `org_id`.
3. `queryKB` is called with the question, check-in context, and the user's `org_id`.
4. `IndexService.query(orgId, question, topK)` retrieves the top-K `IndexedDocument` objects from the in-memory cache (falling back to SQLite).
5. `IndexedDocument` content is formatted into a context string and appended to the existing KB context.
6. Claude generates a structured answer; source documents are included in the response.

### Data Flow: Sync

1. `SyncScheduler` fires every 60 minutes (configurable via `SYNC_INTERVAL_MINUTES` env var).
2. For each `active` `IntegrationConfig`, the scheduler calls the appropriate `Connector.fetch(config)`.
3. The connector returns `IndexedDocument[]`.
4. `IndexService.upsert(orgId, provider, docs)` writes to SQLite and invalidates the in-memory cache for that org.
5. `last_synced_at` is updated on the `IntegrationConfig` record.

---

## Components and Interfaces

### `IndexedDocument` (new type)

```typescript
// backend/src/types/index.ts (additions)
export type IntegrationProvider =
  | 'jira'
  | 'github'
  | 'outlook'
  | 'google_calendar'
  | 'granola'
  | 'knowledge_base';

export type IntegrationStatus = 'active' | 'disabled' | 'error';

export interface IndexedDocument {
  id: string;           // UUID, stable across syncs for the same source item
  orgId: string;
  provider: IntegrationProvider;
  sourceId: string;     // provider-native ID (issue key, PR number, email ID, etc.)
  title: string;
  content: string;
  url: string;          // empty string for KB docs
  fetchedAt: string;    // ISO 8601
}

export interface IntegrationConfig {
  id: string;
  orgId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  encryptedCredentials: string; // AES-256-GCM ciphertext, never returned to clients
  lastSyncedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

// Credential shapes per provider (plaintext, only in memory)
export interface JiraCredentials {
  baseUrl: string;      // e.g. https://acme.atlassian.net
  email: string;
  apiToken: string;
  projectKey: string;
}

export interface GitHubCredentials {
  token: string;
  repos: string[];      // ["owner/repo", ...]
}

export interface OutlookCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;    // ISO 8601
}

export interface GoogleCalendarCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface GranolaCredentials {
  apiKey: string;
}
```

### `Connector` interface

```typescript
// backend/src/services/connectors/types.ts
export interface Connector {
  readonly provider: IntegrationProvider;
  fetch(config: IntegrationConfig): Promise<IndexedDocument[]>;
}
```

### `credentialStore.ts`

```typescript
// backend/src/services/credentialStore.ts
export function encrypt(plaintext: string): string;
export function decrypt(ciphertext: string): string;
// Uses AES-256-GCM. Key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex').
// Ciphertext format: base64(iv:authTag:encrypted) — all three concatenated with ':'.
```

### `integrationIndex.ts`

```typescript
// backend/src/services/integrationIndex.ts
export class IntegrationIndexService {
  // Upsert documents for a provider+org. Replaces all existing docs for that provider+org.
  async upsert(orgId: string, provider: IntegrationProvider, docs: IndexedDocument[]): Promise<void>;

  // Remove all documents for a provider+org (called on config delete).
  async remove(orgId: string, provider: IntegrationProvider): Promise<void>;

  // Return all active documents for an org (from cache or SQLite).
  async getAll(orgId: string): Promise<IndexedDocument[]>;

  // Invalidate in-memory cache for an org.
  invalidate(orgId: string): void;
}

export const indexService = new IntegrationIndexService();
```

### `syncScheduler.ts`

```typescript
// backend/src/services/syncScheduler.ts
export class SyncScheduler {
  start(): void;   // begins setInterval loop
  stop(): void;    // clears interval
  async syncOne(configId: string): Promise<void>; // immediate sync for one config
}

export const syncScheduler = new SyncScheduler();
```

### Extended `queryKB`

The existing `queryKB` signature is extended with an optional `orgId` parameter:

```typescript
export async function queryKB(
  question: string,
  checkinContext?: string | null,
  conversationHistory?: string | null,
  isManager?: boolean,
  orgId?: string | null,          // NEW
): Promise<StructuredAnswer | null>
```

When `orgId` is provided, `IndexService.getAll(orgId)` is called and the resulting documents are ranked by simple keyword overlap against the question (since Claude is already doing semantic ranking in the prompt). The top-K documents are formatted and appended to the existing KB context block.

The `StructuredAnswer` type is extended:

```typescript
export interface StructuredDocument {
  title: string;
  section: string;
  provider?: IntegrationProvider;  // NEW — undefined for legacy KB docs
  url?: string;                    // NEW
}

export interface StructuredAnswer {
  answer: string;
  contacts: { name: string; email?: string; reason: string }[];
  documents: StructuredDocument[];
}
```

### API Routes

**`/api/integrations`** (new router, Manager-only except where noted)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/integrations` | List all configs for the admin's org (credentials masked) |
| POST | `/api/integrations` | Create a new config (status=disabled) |
| PATCH | `/api/integrations/:id` | Update credentials or enable/disable |
| DELETE | `/api/integrations/:id` | Delete config and remove indexed documents |
| GET | `/api/integrations/:id/status` | Get current status and last_synced_at |
| POST | `/api/integrations/:id/sync` | Trigger immediate sync |
| GET | `/api/integrations/oauth/:provider/start` | Returns OAuth authorization URL |
| GET | `/api/integrations/oauth/:provider/callback` | OAuth callback (no auth required) |

---

## Data Models

### New SQLite Tables

```sql
-- Added via migration (does not modify existing tables)
ALTER TABLE users ADD COLUMN org_id TEXT NOT NULL DEFAULT 'default';

CREATE TABLE IF NOT EXISTS integration_configs (
  id                   TEXT PRIMARY KEY,
  org_id               TEXT NOT NULL,
  provider             TEXT NOT NULL CHECK(provider IN (
                         'jira','github','outlook','google_calendar','granola','knowledge_base'
                       )),
  status               TEXT NOT NULL DEFAULT 'disabled'
                         CHECK(status IN ('active','disabled','error')),
  encrypted_credentials TEXT NOT NULL DEFAULT '',
  last_synced_at       TEXT,
  error_message        TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_configs_org
  ON integration_configs(org_id);

CREATE TABLE IF NOT EXISTS indexed_documents (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  provider    TEXT NOT NULL,
  source_id   TEXT NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  url         TEXT NOT NULL DEFAULT '',
  fetched_at  TEXT NOT NULL,
  UNIQUE(org_id, provider, source_id)
);

CREATE INDEX IF NOT EXISTS idx_indexed_documents_org_provider
  ON indexed_documents(org_id, provider);
```

### Migration Strategy

A new `backend/src/db/migrate.ts` function `runMigrations()` is called from `start()` in `index.ts` after `initDb()`. It uses a `schema_migrations` table to track applied migrations. The first migration adds `org_id` to `users` with `DEFAULT 'default'`, ensuring all 16 seed users belong to the `'default'` org without any changes to `seed.ts`.

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
```

### Org ID Resolution

Since there is no `org_id` on the JWT payload, the backend resolves `org_id` from the database on each request:

```typescript
// backend/src/middleware/auth.ts (extended)
// After verifyToken, attach orgId to req.user:
const userRow = db.prepare('SELECT org_id FROM users WHERE id = ?').get(payload.id);
req.user = { id: payload.id, role: payload.role, managerId: payload.managerId, orgId: userRow?.org_id ?? 'default' };
```

The `Express.Request` augmentation is updated to include `orgId: string`.

---

## Connector Implementations

### KnowledgeBaseConnector

Wraps the existing `loadKbDocuments()`. Does not require credentials. Always enabled.

```typescript
class KnowledgeBaseConnector implements Connector {
  readonly provider = 'knowledge_base' as const;

  fetch(_config: IntegrationConfig): Promise<IndexedDocument[]> {
    const kbDocs = loadKbDocuments();
    return Promise.resolve(kbDocs.map(doc => ({
      id: `kb:${doc.source}:${doc.section}`,
      orgId: _config.orgId,
      provider: 'knowledge_base',
      sourceId: `${doc.source}:${doc.section}`,
      title: doc.title,
      content: doc.content,
      url: '',
      fetchedAt: new Date().toISOString(),
    })));
  }
}
```

The existing `setKbDocuments` / `getKbDocuments` in-memory store is preserved for backward compatibility with the existing `queryKB` path. The KB connector supplements this — it does not replace it.

### JiraConnector

Uses Jira REST API v3 (`/rest/api/3/search`). Fetches issues updated within the last 90 days using JQL: `project = {key} AND updated >= -90d ORDER BY updated DESC`. Normalizes to `IndexedDocument`. Handles 401/403 (set status=error), 429 (Retry-After header, max 3 retries).

### GitHubConnector

Uses GitHub REST API. Fetches open PRs and PRs merged within 60 days (`/repos/{owner}/{repo}/pulls?state=all&sort=updated&direction=desc`). Fetches README via `/repos/{owner}/{repo}/readme`. This connector is **separate** from the existing `github.ts` service (which handles blame contacts) — the two do not interfere.

### OutlookConnector

Uses Microsoft Graph API (`/me/messages`). Fetches messages from the last 30 days. Strips HTML from body using a simple regex-based stripper (no new dependencies). Excludes emails where both subject and body are empty. Max 200 emails per sync.

### GoogleCalendarConnector

Uses Google Calendar API (`/calendars/primary/events`). Fetches events in the window `[now - 14d, now + 30d]`. Excludes events with no summary and no attendees. Max 500 events per sync.

### GranolaConnector

Granola is treated as a real API with API key auth. The connector is implemented against a defined interface:

```
GET https://api.granola.ai/v1/documents
  Authorization: Bearer {apiKey}
  Response: { documents: [{ id, title, body, permalink, updatedAt }] }
```

If the real API is unavailable, the connector returns an empty array and logs a warning rather than throwing. The interface is designed so the HTTP client can be swapped in without changing the connector's public API.

### OAuth Flow

For Outlook and Google Calendar, the OAuth flow works as follows:

1. Extension calls `GET /api/integrations/oauth/{provider}/start?configId={id}`.
2. Backend generates the authorization URL (using the provider's OAuth 2.0 endpoint) and returns it as JSON: `{ url: "https://..." }`.
3. Extension opens the URL in a new browser tab via `chrome.tabs.create({ url })`.
4. User completes OAuth in the browser tab.
5. Provider redirects to `GET /api/integrations/oauth/{provider}/callback?code=...&state=...`.
6. Backend exchanges the code for tokens, encrypts them, stores them in `integration_configs`, and serves a small HTML page that closes the tab: `<script>window.close()</script>`.

The `state` parameter encodes the `configId` and a CSRF nonce (stored in the session or a short-lived DB record).

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Connector fetch throws (network error) | Log error with `configId` and `provider`; do not update `last_synced_at`; retry at next scheduled interval |
| Connector returns HTTP 401/403 | Set `integration_configs.status = 'error'`, set `error_message`; do not retry until credentials are updated |
| Connector returns HTTP 429 | Respect `Retry-After` / `X-RateLimit-Reset` header; retry up to 3 times; if all retries exhausted, log and skip this sync cycle |
| OAuth token expired, refresh succeeds | Transparently update stored tokens; continue sync |
| OAuth token expired, refresh fails | Set `status = 'error'`, set `error_message = 'OAuth token refresh failed'`; do not retry |
| `ENCRYPTION_KEY` not set | Throw at startup with a clear error message; do not start the server |
| `IndexService.getAll` fails | `queryKB` falls back to KB-only context; logs the error; does not surface to the user |
| Concurrent sync attempt | `SyncScheduler` maintains a `Set<string>` of in-progress config IDs; skips if already running |
| Admin deletes config while sync in progress | Sync completes; `IndexService.remove` is called after; documents are cleaned up |

---

## Testing Strategy

### Unit Tests

- `credentialStore.ts`: encrypt/decrypt round-trip, key validation, error on missing key.
- Each connector's `normalize` function: given a raw API response object, verify the `IndexedDocument` fields.
- `IntegrationIndexService`: upsert, remove, getAll with mock SQLite.
- `SyncScheduler`: concurrent sync prevention, immediate sync on enable.
- `queryKB` extension: verify `IndexedDocument` context is appended correctly.

### Property-Based Tests

Using `fast-check` (already in `devDependencies`). Each property test runs a minimum of 100 iterations.

See Correctness Properties section below for the full list.

### Integration Tests

- Full sync cycle with mocked HTTP clients for each connector.
- OAuth callback flow with mocked provider responses.
- `POST /api/kb/ask` with a seeded index returns documents from multiple providers.
- Role-based access: `New_Employee` token returns 403 on all `/api/integrations` write endpoints.

### Snapshot / Example Tests

- Integration Dashboard renders correctly for each status (`active`, `disabled`, `error`).
- Source attribution chips render with correct provider icons.
- Empty KB directory returns empty array without throwing.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Org isolation in query results

*For any* two distinct orgs, querying the Integration Index for org A shall never return documents whose `orgId` field equals org B's ID.

**Validates: Requirements 1.1, 9.4**

---

### Property 2: New integration config always starts disabled

*For any* valid provider and credential combination, a newly created `IntegrationConfig` shall have `status = 'disabled'`.

**Validates: Requirements 1.2**

---

### Property 3: Invalid provider values are rejected

*For any* string that is not a member of the valid `IntegrationProvider` set (`jira`, `github`, `outlook`, `google_calendar`, `granola`, `knowledge_base`), a create request using that string as the `provider` field shall return HTTP 400.

**Validates: Requirements 1.3**

---

### Property 4: Disabled integration documents are excluded from queries

*For any* org and any integration config that has `status = 'disabled'`, querying the Integration Index for that org shall return zero documents whose `provider` matches the disabled integration's provider.

**Validates: Requirements 1.6**

---

### Property 5: Deleted integration documents are fully removed

*For any* org and any integration config that has been deleted, the Integration Index for that org shall contain zero documents whose `provider` and `orgId` match the deleted config.

**Validates: Requirements 1.7**

---

### Property 6: Manager-only endpoints reject non-Manager users

*For any* JWT token belonging to a user with role `New_Employee`, all write endpoints under `/api/integrations` shall return HTTP 403.

**Validates: Requirements 1.8, 12.6**

---

### Property 7: Credentials are never stored in plaintext

*For any* credential string, after persisting an `IntegrationConfig`, the value stored in the `encrypted_credentials` column of the database shall not equal the original plaintext credential string.

**Validates: Requirements 2.1**

---

### Property 8: Credentials are never returned in API responses

*For any* credential string used to create an `IntegrationConfig`, no API response body from any `/api/integrations` endpoint shall contain that raw credential string.

**Validates: Requirements 2.2**

---

### Property 9: Empty/whitespace credentials are rejected

*For any* credential value that is an empty string or a string composed entirely of whitespace characters, a create or update request using that value shall be rejected with HTTP 400.

**Validates: Requirements 2.5**

---

### Property 10: Connector normalization preserves required fields

*For any* raw API response object from any connector (Jira issue, GitHub PR, Outlook email, Google Calendar event, Granola note), the resulting `IndexedDocument` shall have:
- `provider` equal to the connector's declared provider string
- `title` that is a non-empty string
- `content` that is a non-empty string (falling back to title when description/body is absent)
- `url` that is a string (may be empty for KB docs)
- `orgId` equal to the config's `orgId`

**Validates: Requirements 3.2, 3.3, 4.2, 4.3, 5.2, 5.3, 6.2, 6.3, 7.2, 7.4, 8.1, 8.2**

---

### Property 11: Date-window filtering excludes stale documents

*For any* collection of raw API items with varying `updatedAt` / `lastModified` timestamps, the connector shall include only items whose timestamp falls within the connector's configured lookback window (90 days for Jira, 60 days for GitHub and Granola, 30 days for Outlook, ±14/30 days for Google Calendar).

**Validates: Requirements 3.4, 4.4, 5.1, 6.1, 7.3**

---

### Property 12: IndexedDocument JSON round-trip

*For any* list of `IndexedDocument` objects, serializing the list to JSON and then deserializing it shall produce a list that is deeply equal to the original (all fields preserved with correct types).

**Validates: Requirements 9.6**

---

### Property 13: Source attribution fields are fully populated

*For any* set of `IndexedDocument` objects used as sources in a `queryKB` response, each entry in the `documents` array of the `StructuredAnswer` shall have `provider`, `title`, and `url` fields populated (url may be an empty string for KB docs, but must be present).

**Validates: Requirements 11.1**

---

### Property 14: URL-conditional source rendering

*For any* source document, if `url` is a non-empty string then the rendered source chip shall contain an anchor element with `href` equal to `url` and `target="_blank"`; if `url` is an empty string then the rendered source chip shall contain no anchor element.

**Validates: Requirements 11.3, 11.4**

---

### Property 15: KnowledgeBase connector produces correct provider tag

*For any* `KbDoc` returned by `loadKbDocuments()`, the `IndexedDocument` produced by the `KnowledgeBaseConnector` shall have `provider = 'knowledge_base'`, `title = KbDoc.title`, `content = KbDoc.content`, and `url = ''`.

**Validates: Requirements 8.1, 8.2**

---

## Property Reflection

After reviewing the 15 properties above:

- **Properties 10 and 15** overlap: Property 15 is a specific instance of Property 10 for the KB connector. However, Property 15 is kept because it explicitly validates the KB connector's preservation of the existing `kbLoader` contract, which is a critical backward-compatibility constraint. They test different code paths.
- **Properties 4 and 5** are distinct: Property 4 tests query-time exclusion of disabled integrations; Property 5 tests physical removal of documents on deletion. Both are necessary.
- **Properties 7 and 8** are distinct: Property 7 tests the storage layer (DB column value); Property 8 tests the API layer (HTTP response body). Both are necessary for defense-in-depth.
- **Properties 1 and 4** are distinct: Property 1 tests cross-org isolation; Property 4 tests within-org disabled-status exclusion.

No properties are redundant. All 15 are retained.
