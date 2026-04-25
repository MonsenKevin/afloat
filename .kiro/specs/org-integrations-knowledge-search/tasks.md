# Implementation Plan: Org Integrations & Knowledge Search

## Overview

Extend Mission Control's AI assistant to search across Jira, GitHub, Outlook, Google Calendar, Granola, and the existing static KB when answering employee queries. Org admins (Managers) configure integrations via a new dashboard. The implementation extends the existing `queryKB` / `vectorStore` pipeline without touching `seed.ts`, `github-mock.json`, or the `data/kb/` files.

All code is TypeScript. Tests use Jest + `fast-check` (already in `devDependencies`).

---

## Tasks

- [x] 1. Database migrations and type extensions
  - [x] 1.1 Add `runMigrations()` to `backend/src/db/migrate.ts`
    - Create `schema_migrations` table if it does not exist
    - Apply migration `001_add_org_id`: `ALTER TABLE users ADD COLUMN org_id TEXT NOT NULL DEFAULT 'default'` (idempotent — skip if column already exists)
    - Apply migration `002_integration_tables`: create `integration_configs` and `indexed_documents` tables plus their indexes (use `CREATE TABLE IF NOT EXISTS`)
    - Call `saveDb()` after applying any new migration
    - Wire `runMigrations()` into `backend/src/index.ts` `start()` after `initDb()` and before `runSeed()`
    - _Requirements: 1.1, 2.1, 9.4_

  - [x] 1.2 Extend `backend/src/types/index.ts` with new shared types
    - Add `IntegrationProvider`, `IntegrationStatus`, `IndexedDocument`, `IntegrationConfig` interfaces
    - Add per-provider credential interfaces: `JiraCredentials`, `GitHubCredentials`, `OutlookCredentials`, `GoogleCalendarCredentials`, `GranolaCredentials`
    - Extend `StructuredAnswer` to add optional `provider` and `url` fields on the `documents` array entries (keep existing `title` and `section` fields)
    - Extend the `Express.Request` augmentation to add `orgId: string` to `req.user`
    - _Requirements: 1.1, 9.1, 11.1_

  - [x] 1.3 Extend `backend/src/middleware/auth.ts` to resolve and attach `orgId`
    - After `verifyToken`, query `SELECT org_id FROM users WHERE id = ?` and attach `orgId` (default `'default'` if null) to `req.user`
    - _Requirements: 9.4_

- [ ] 2. Credential store
  - [x] 2.1 Create `backend/src/services/credentialStore.ts`
    - Implement `encrypt(plaintext: string): string` using Node.js `crypto` AES-256-GCM
    - Implement `decrypt(ciphertext: string): string`
    - Ciphertext format: `base64(iv + ':' + authTag + ':' + encrypted)`
    - Derive key from `process.env.ENCRYPTION_KEY` (32-byte hex); throw a clear startup error if not set
    - Validate that `ENCRYPTION_KEY` is present in `backend/src/index.ts` `start()` before `initDb()`
    - _Requirements: 2.1, 2.5_

  - [ ]* 2.2 Write property test for credential store round-trip
    - **Property 7: Credentials are never stored in plaintext**
    - **Validates: Requirements 2.1**
    - Use `fast-check` `fc.string()` to generate arbitrary plaintexts; assert `encrypt(s) !== s` and `decrypt(encrypt(s)) === s`

- [x] 3. Integration Index service
  - [x] 3.1 Create `backend/src/services/integrationIndex.ts`
    - Implement `IntegrationIndexService` class with `upsert`, `remove`, `getAll`, and `invalidate` methods
    - `upsert`: delete all existing rows for `(orgId, provider)` then bulk-insert new docs; invalidate cache
    - `remove`: delete all rows for `(orgId, provider)`; invalidate cache
    - `getAll`: return from in-memory `Map<string, IndexedDocument[]>` cache; on miss, load from `indexed_documents` table and populate cache
    - Export singleton `indexService`
    - _Requirements: 1.6, 1.7, 9.1, 9.4_

  - [ ]* 3.2 Write property test for org isolation
    - **Property 1: Org isolation in query results**
    - **Validates: Requirements 1.1, 9.4**
    - Use `fast-check` to generate two distinct `orgId` strings and two sets of `IndexedDocument` arrays; upsert each set under its org; assert `getAll(orgA)` contains no docs with `orgId === orgB`

  - [ ]* 3.3 Write property test for disabled integration exclusion
    - **Property 4: Disabled integration documents are excluded from queries**
    - **Validates: Requirements 1.6**
    - Upsert docs for a provider, then call `remove` for that provider; assert `getAll` returns zero docs for that provider

- [x] 4. Connector infrastructure and KnowledgeBase connector
  - [x] 4.1 Create `backend/src/services/connectors/types.ts`
    - Define `Connector` interface with `provider: IntegrationProvider` and `fetch(config: IntegrationConfig): Promise<IndexedDocument[]>`
    - _Requirements: 8.1_

  - [x] 4.2 Create `backend/src/services/connectors/KnowledgeBaseConnector.ts`
    - Implement `KnowledgeBaseConnector` wrapping `loadKbDocuments()`
    - Map each `KbDoc` to `IndexedDocument` with `provider = 'knowledge_base'`, `url = ''`, stable `id = 'kb:' + doc.source + ':' + doc.section`
    - Return empty array (no throw) when `loadKbDocuments()` returns empty
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 4.3 Write property test for KnowledgeBase connector field mapping
    - **Property 15: KnowledgeBase connector produces correct provider tag**
    - **Validates: Requirements 8.1, 8.2**
    - Use `fast-check` to generate arbitrary `KbDoc` arrays; assert each resulting `IndexedDocument` has `provider = 'knowledge_base'`, `title = doc.title`, `content = doc.content`, `url = ''`

- [x] 5. Checkpoint — core infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Jira, GitHub, Outlook, Google Calendar, and Granola connectors
  - [x] 6.1 Create `backend/src/services/connectors/JiraConnector.ts`
    - Fetch issues via Jira REST API v3 `/rest/api/3/search` with JQL `project = {key} AND updated >= -90d ORDER BY updated DESC`
    - Normalize each issue to `IndexedDocument`; fall back `content` to `title` when description is absent
    - Handle HTTP 401/403 → set config `status = 'error'`; HTTP 429 → respect `Retry-After`, max 3 retries
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 6.2 Create `backend/src/services/connectors/GitHubConnector.ts`
    - Fetch PRs (`/repos/{owner}/{repo}/pulls?state=all&sort=updated&direction=desc`) and README (`/repos/{owner}/{repo}/readme`) for each configured repo
    - Filter PRs to those updated within 60 days; normalize to `IndexedDocument`
    - Handle HTTP 401/403 → error status; HTTP 429 → `X-RateLimit-Reset` header, max 3 retries
    - This connector is separate from the existing `github.ts` blame service — do not modify `github.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 6.3 Create `backend/src/services/connectors/OutlookConnector.ts`
    - Fetch messages via Microsoft Graph API `/me/messages` scoped to last 30 days; max 200 per sync
    - Strip HTML from body using a regex-based stripper (no new dependencies)
    - Exclude emails where subject and body are both empty after stripping
    - Handle HTTP 401 → attempt token refresh once; on failure set error status
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 6.4 Create `backend/src/services/connectors/GoogleCalendarConnector.ts`
    - Fetch events via Google Calendar API `/calendars/primary/events` in window `[now - 14d, now + 30d]`; max 500 per sync
    - Normalize to `IndexedDocument`; fall back `content` to summary + attendee names when description absent
    - Exclude events with no summary and no attendees
    - Handle HTTP 401 → attempt token refresh once; on failure set error status
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 6.5 Create `backend/src/services/connectors/GranolaConnector.ts`
    - Fetch documents from `GET https://api.granola.ai/v1/documents` with `Authorization: Bearer {apiKey}`
    - Filter to notes updated within 60 days; fall back `content` to title when body is absent
    - Return empty array (with warning log) if API is unreachable rather than throwing
    - Handle HTTP 401/403 → error status; HTTP 429 → wait 60 s, max 3 retries
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 6.6 Write property tests for connector normalization
    - **Property 10: Connector normalization preserves required fields**
    - **Validates: Requirements 3.2, 3.3, 4.2, 4.3, 5.2, 5.3, 6.2, 6.3, 7.2, 7.4**
    - For each connector, use `fast-check` to generate arbitrary raw API response objects; assert each `IndexedDocument` has non-empty `title`, non-empty `content`, string `url`, correct `provider`, and `orgId` matching the config

  - [ ]* 6.7 Write property test for date-window filtering
    - **Property 11: Date-window filtering excludes stale documents**
    - **Validates: Requirements 3.4, 4.4, 5.1, 6.1, 7.3**
    - Generate raw items with `updatedAt` timestamps spanning a wide range; assert only items within each connector's lookback window are included in the output

- [x] 7. Sync scheduler
  - [x] 7.1 Create `backend/src/services/syncScheduler.ts`
    - Implement `SyncScheduler` class with `start()`, `stop()`, and `syncOne(configId)` methods
    - `start()` sets a `setInterval` at `SYNC_INTERVAL_MINUTES` (default 60) minutes; each tick fetches all `active` configs and calls `syncOne` for each
    - `syncOne`: look up config, call the appropriate connector, call `indexService.upsert`, update `last_synced_at`, handle errors by setting `status = 'error'` and `error_message`
    - Maintain a `Set<string>` of in-progress config IDs; skip if already running
    - Export singleton `syncScheduler`
    - Wire `syncScheduler.start()` into `backend/src/index.ts` `start()` after KB load
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 7.2 Write unit test for concurrent sync prevention
    - **Property (example): concurrent sync prevention**
    - Verify that calling `syncOne` for the same config ID twice concurrently results in only one actual connector fetch
    - _Requirements: 10.5_

- [x] 8. Extend `queryKB` with integration index context
  - [x] 8.1 Extend `backend/src/services/vectorStore.ts`
    - Add optional `orgId?: string | null` parameter to `queryKB`
    - When `orgId` is provided, call `indexService.getAll(orgId)` and rank results by keyword overlap against the question; take top 20 (configurable)
    - Format `IndexedDocument` results into a context block appended after the existing KB context
    - Extend `StructuredAnswer.documents` entries to include optional `provider` and `url` fields
    - Fall back gracefully (KB-only context) if `indexService.getAll` throws; log the error
    - _Requirements: 9.1, 9.2, 9.5, 11.1_

  - [x] 8.2 Update `backend/src/routes/kb.ts` to pass `orgId` to `queryKB`
    - Extract `req.user!.orgId` and pass it as the fifth argument to `queryKB`
    - _Requirements: 9.1, 9.4_

  - [ ]* 8.3 Write property test for IndexedDocument JSON round-trip
    - **Property 12: IndexedDocument JSON round-trip**
    - **Validates: Requirements 9.6**
    - Use `fast-check` to generate arbitrary `IndexedDocument[]`; assert `JSON.parse(JSON.stringify(docs))` is deeply equal to the original

  - [ ]* 8.4 Write property test for source attribution fields
    - **Property 13: Source attribution fields are fully populated**
    - **Validates: Requirements 11.1**
    - Generate arbitrary `IndexedDocument[]` used as sources; assert each entry in `StructuredAnswer.documents` has `provider`, `title`, and `url` present

- [x] 9. Checkpoint — backend integration complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Integration Config API routes
  - [x] 10.1 Create `backend/src/routes/integrations.ts`
    - `GET /api/integrations` — list all configs for `req.user.orgId`; mask `encrypted_credentials` as `"••••••••"` in response
    - `POST /api/integrations` — validate `provider` (HTTP 400 on invalid) and required credential fields (HTTP 400 on missing); encrypt credentials; persist with `status = 'disabled'`
    - `PATCH /api/integrations/:id` — update credentials or status; re-encrypt if credentials change; on enable (`status → active`) call `syncScheduler.syncOne(id)`
    - `DELETE /api/integrations/:id` — delete config; call `indexService.remove(orgId, provider)`
    - `GET /api/integrations/:id/status` — return `status`, `last_synced_at`, `error_message`
    - `POST /api/integrations/:id/sync` — call `syncScheduler.syncOne(id)` immediately
    - Apply `requireAuth` + `requireManager` middleware to all routes
    - Register router in `backend/src/index.ts` as `app.use('/api/integrations', integrationsRouter)`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.2, 2.5_

  - [ ]* 10.2 Write property test for new config always starts disabled
    - **Property 2: New integration config always starts disabled**
    - **Validates: Requirements 1.2**
    - Use `fast-check` to generate valid provider + credential combinations; assert the persisted record has `status = 'disabled'`

  - [ ]* 10.3 Write property test for invalid provider rejection
    - **Property 3: Invalid provider values are rejected**
    - **Validates: Requirements 1.3**
    - Use `fast-check` `fc.string()` filtered to exclude valid provider names; assert `POST /api/integrations` returns HTTP 400

  - [ ]* 10.4 Write property test for Manager-only access
    - **Property 6: Manager-only endpoints reject non-Manager users**
    - **Validates: Requirements 1.8, 12.6**
    - Use `fast-check` to generate arbitrary request bodies; assert all write endpoints return HTTP 403 when called with a `New_Employee` JWT

  - [ ]* 10.5 Write property test for credentials never returned in API responses
    - **Property 8: Credentials are never returned in API responses**
    - **Validates: Requirements 2.2**
    - Use `fast-check` `fc.string()` to generate credential strings; create a config, then call `GET /api/integrations`; assert the response body does not contain the raw credential string

- [x] 11. OAuth flow routes
  - [x] 11.1 Add OAuth routes to `backend/src/routes/integrations.ts`
    - `GET /api/integrations/oauth/:provider/start?configId=` — generate and return the provider's OAuth authorization URL with a CSRF nonce encoded in `state`; store nonce in a short-lived `oauth_states` table (add via migration)
    - `GET /api/integrations/oauth/:provider/callback?code=&state=` — validate CSRF nonce; exchange code for tokens; encrypt and store tokens; serve `<script>window.close()</script>` HTML response
    - No auth middleware on the callback route (browser tab, no extension token)
    - _Requirements: 2.1, 2.3, 2.4_

- [x] 12. Extension types and API client updates
  - [x] 12.1 Extend `extension/src/types/index.ts` with integration types
    - Add `IntegrationProvider`, `IntegrationStatus`, `IntegrationConfig` (with masked credentials), and `IndexedDocument` types mirroring the backend
    - Extend the `documents` field in `ChatMessage.data` to include optional `provider` and `url` fields
    - _Requirements: 11.1, 12.1_

  - [x] 12.2 Add integration API functions to `extension/src/api/client.ts` (or a new `integrations.ts` module)
    - `listIntegrations()`, `createIntegration(payload)`, `updateIntegration(id, payload)`, `deleteIntegration(id)`, `getIntegrationStatus(id)`, `triggerSync(id)`, `startOAuth(provider, configId)`
    - _Requirements: 12.1, 12.3, 12.4_

- [x] 13. Integration Status Dashboard component
  - [x] 13.1 Create `extension/src/components/Integrations/IntegrationDashboard.tsx`
    - Fetch and display all `IntegrationConfig` records for the admin's org on mount
    - Show provider name, status badge (`active` / `disabled` / `error`), and `last_synced_at` for each config
    - Show a human-readable error message and visual error indicator when `status = 'error'`
    - Provide enable, disable, and delete controls per config
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 13.2 Add "Add Integration" form to `IntegrationDashboard.tsx`
    - Render provider-specific credential fields based on the selected provider (Jira: baseUrl, email, apiToken, projectKey; GitHub: token, repos; Granola: apiKey; Outlook/Google Calendar: OAuth button)
    - Inline validation: show field-level errors without submitting when required fields are missing or empty
    - On successful creation, append the new config to the list
    - For OAuth providers, call `startOAuth` and open the returned URL via `chrome.tabs.create`
    - _Requirements: 12.4, 12.5_

  - [x] 13.3 Gate `IntegrationDashboard` behind Manager role in `extension/src/components/MainShell.tsx` (or `App.tsx`)
    - Only render the Integrations tab/section when `user.role === 'Manager'`
    - _Requirements: 12.6_

- [x] 14. Update Chat component for enhanced source attribution
  - [x] 14.1 Update `extension/src/store/chatStore.ts` to forward `provider` and `url` from API response documents
    - Extend `ChatMessage.data.documents` type to include optional `provider` and `url`
    - _Requirements: 11.1_

  - [x] 14.2 Update `extension/src/components/Chat/Chat.tsx` source attribution rendering
    - Render a provider-specific icon (Jira, GitHub, Outlook, Google Calendar, Granola, KB) alongside each source chip
    - When `url` is non-empty, render the source title as `<a href={url} target="_blank" rel="noreferrer">`
    - When `url` is empty, render the source title as plain text
    - Group source chips under a "Sources" heading consistent with the existing design
    - _Requirements: 11.2, 11.3, 11.4, 11.5_

  - [ ]* 14.3 Write property test for URL-conditional source rendering
    - **Property 14: URL-conditional source rendering**
    - **Validates: Requirements 11.3, 11.4**
    - Use `fast-check` to generate source objects with arbitrary `url` values; assert that non-empty `url` produces an anchor with correct `href` and `target="_blank"`, and empty `url` produces no anchor element

- [x] 15. Final checkpoint — full feature integration
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- `backend/data/github-mock.json`, `backend/src/db/seed.ts`, and all files under `backend/data/kb/` must not be modified
- All existing routes, services, and DB tables continue to work unchanged
- The `GitHubConnector` (task 6.2) is a new service for indexing PRs/READMEs; it does not touch the existing `github.ts` blame service
- Migrations are additive only — no existing columns or tables are altered or dropped
- `ENCRYPTION_KEY` must be set in `backend/.env` before starting the server; the startup check (task 2.1) will throw a clear error if it is missing
- Property tests use `fast-check` which is already in `devDependencies`; run with `npm test` in the `backend/` directory
