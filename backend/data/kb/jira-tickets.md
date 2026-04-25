# Active JIRA Tickets

## ENG-4421: Expose WebSocket endpoint for real-time dashboard updates

**Status:** In Progress  
**Assignee:** Rosa Delgado  
**Sprint:** Sprint 47  
**Priority:** High  
**Epic:** Customer Dashboard v2 (PRD-001)

### Description

The customer dashboard v2 requires real-time data updates. We need to expose a WebSocket endpoint from the platform API that pushes account balance and transaction updates to connected clients.

### Acceptance Criteria

- [x] WebSocket endpoint available at `wss://api.acme.com/ws/v1/accounts/:id`
- [x] Endpoint requires valid JWT authentication
- [x] Pushes events: `balance_updated`, `transaction_created`, `transaction_updated`
- [x] Reconnection logic handles dropped connections with exponential backoff
- [x] Load tested to 10,000 concurrent connections without degradation
- [ ] Unit tests cover auth rejection, event emission, and reconnection

### Notes

Blocked on DATA-88 SLA confirmation before we can ship. Coordinate with Ben on the pipeline latency findings.

---

## ENG-4398: Fix duplicate Slack notifications on webhook retry

**Status:** Shipped (v1.4.3)  
**Assignee:** Sasha Petrov  
**Sprint:** Sprint 47  
**Priority:** Medium  
**Epic:** Notification Center (PRD-003)

### Description

When Slack's webhook endpoint returns a 5xx error, our retry logic sends the notification again. If Slack was actually processing the first request, this results in duplicate notifications. Affects approximately 2% of Slack notifications based on error logs.

### Root Cause

The notification worker did not implement idempotency keys. Slack's API supports `X-Slack-No-Retry: 1` header to suppress retries on their side.

### Resolution

Added Redis-backed idempotency keys with 24h TTL. Added `X-Slack-No-Retry: 1` header to all Slack webhook requests. Regression test added.

---

## ENG-4401: Email digest ignores user timezone

**Status:** Open  
**Assignee:** Unassigned  
**Sprint:** Backlog  
**Priority:** Low  
**Epic:** Notification Center (PRD-003)

### Description

The daily email digest is sent at 8:00 AM UTC for all users regardless of their configured timezone. Users in PST receive the digest at midnight, which is not useful.

### Acceptance Criteria

- [ ] Read `timezone` field from user profile
- [ ] Schedule digest send time based on user's local 8:00 AM
- [ ] Handle users with no timezone set (default to UTC)
- [ ] Batch sends by timezone to avoid thundering herd

---

## ENG-4455: Migrate auth service from JWT RS256 to ES256

**Status:** In Progress  
**Assignee:** Sasha Petrov  
**Sprint:** Sprint 48  
**Priority:** Medium

### Description

Our current JWT signing uses RS256 (RSA 2048-bit). Security review recommends migrating to ES256 (ECDSA P-256) for better performance and equivalent security. ES256 tokens are ~40% smaller and verify ~10x faster.

### Acceptance Criteria

- [x] Generate new ES256 key pair and store in secrets manager
- [x] Update token signing to use ES256
- [ ] Support both RS256 and ES256 during transition period (30 days)
- [ ] Update all services that verify JWTs
- [ ] Rotate old RS256 keys after transition period
- [ ] Document key rotation procedure in runbook

---

## ENG-4460: Add rate limiting to public API endpoints

**Status:** In Progress  
**Assignee:** Alex Rivera  
**Sprint:** Sprint 47  
**Priority:** High

### Description

The public API currently has no rate limiting. A customer accidentally ran a script that made 50,000 requests in 10 minutes, causing elevated database load. We need per-API-key rate limiting.

### Acceptance Criteria

- [x] Rate limit: 1,000 requests per minute per API key
- [x] Return 429 Too Many Requests with `Retry-After` header when limit exceeded
- [x] Rate limit state stored in Redis (not in-memory, to work across instances)
- [ ] Exempt internal service-to-service calls from rate limiting
- [ ] Add rate limit headers to all responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [ ] Dashboard in Datadog showing rate limit hits by API key

### Notes

Use the token bucket algorithm. Reference implementation in `src/middleware/rateLimiter.ts`. Jordan is helping with the Redis config.

---

## ENG-4471: Onboarding checklist for new engineers

**Status:** Open  
**Assignee:** Alex Rivera  
**Sprint:** Sprint 48  
**Priority:** Low

### Description

New engineers spend significant time figuring out what to do in their first week. We should create an interactive onboarding checklist in the internal portal that tracks completion of key setup steps.

### Acceptance Criteria

- [ ] Checklist items: dev environment setup, first PR merged, first on-call shadow, met with manager, met with skip-level, read team charter
- [ ] Checklist persists per user in the database
- [ ] Manager can view completion status for their reports
- [ ] Checklist auto-dismisses after 90 days

---

## ENG-4480: Add structured logging to all API endpoints

**Status:** Open  
**Assignee:** Jordan Kim  
**Sprint:** Sprint 48  
**Priority:** Medium

### Description

Currently our API logs are unstructured strings. This makes it hard to query logs in Datadog. We need to migrate to structured JSON logging using the `pino` library.

### Acceptance Criteria

- [ ] All API endpoints emit structured JSON logs with: `requestId`, `method`, `path`, `statusCode`, `durationMs`, `userId`
- [ ] Error logs include stack traces
- [ ] Log level configurable via `LOG_LEVEL` env var
- [ ] No PII in logs (mask email, phone, SSN fields)

---

## ENG-4485: Implement cursor-based pagination for /api/transactions

**Status:** Open  
**Assignee:** Devon Okafor  
**Sprint:** Sprint 48  
**Priority:** High

### Description

The `/api/transactions` endpoint uses offset-based pagination which becomes slow for large datasets. Customers with 100k+ transactions are seeing 3-5s response times on later pages. Migrate to cursor-based pagination.

### Acceptance Criteria

- [ ] Replace `?page=N&limit=M` with `?cursor=<opaque_token>&limit=M`
- [ ] Cursor encodes the last seen `id` and `created_at`
- [ ] Response includes `nextCursor` (null if no more results)
- [ ] Backwards compatible — old pagination params still work for 90 days
- [ ] P95 latency < 200ms for any page

---

## DS-112: Mobile-responsive card components

**Status:** Shipped (v2.4.0)  
**Assignee:** Priyanka Nair  
**Sprint:** Sprint 46  
**Priority:** High  
**Epic:** Customer Dashboard v2 (PRD-001)

### Resolution

Card component now supports fluid width down to 320px. Storybook stories added for mobile, tablet, and desktop. Exported from `@acme/design-system` v2.4.0. Migration guide published in Confluence.

---

## DS-115: Data table component

**Status:** Shipped (v2.5.0)  
**Assignee:** Priyanka Nair  
**Sprint:** Sprint 47  
**Priority:** High

### Description

The design system needs a reusable data table component with sorting, filtering, and pagination built in.

### Resolution

Shipped in v2.5.0. Supports virtual scrolling for large datasets, column resizing, and row selection. Used by the analytics dashboard and the transactions list.

---

## DS-118: Form components v2

**Status:** In Progress  
**Assignee:** Priyanka Nair  
**Sprint:** Sprint 48  
**Priority:** Medium

### Description

Redesign the form input components to match the new design language. Includes text inputs, selects, checkboxes, radio buttons, and date pickers.

### Acceptance Criteria

- [ ] All form components support controlled and uncontrolled modes
- [ ] Full keyboard navigation
- [ ] WCAG 2.1 AA compliant
- [ ] Storybook stories with all variants
- [ ] Migration guide from v1 form components

---

## DS-119: Icon library

**Status:** In Progress  
**Assignee:** Tai Nguyen  
**Sprint:** Sprint 48  
**Priority:** Low

### Description

Consolidate all icons used across the product into a single icon library exported from the design system. Currently icons are scattered across multiple packages and some are duplicated.

### Acceptance Criteria

- [ ] 200+ icons covering all current usage
- [ ] SVG-based, tree-shakeable exports
- [ ] Each icon available in 16px, 20px, and 24px sizes
- [ ] Figma library synced with code

---

## DATA-88: Real-time pipeline SLA for dashboard WebSocket

**Status:** In Progress  
**Assignee:** Ben Hartley  
**Sprint:** Sprint 47  
**Priority:** High  
**Epic:** Customer Dashboard v2 (PRD-001)

### Description

The dashboard v2 WebSocket feature requires the data pipeline to deliver account balance updates within 5 seconds of a transaction completing. Current pipeline P95 latency is 8 seconds.

### Findings (Ben's analysis)

Current bottlenecks identified:
1. **Kafka consumer lag** — consumer group is 2-3 partitions behind during peak hours (adds ~2s)
2. **Database write amplification** — balance update triggers 4 downstream writes (adds ~1.5s)
3. **Serialization overhead** — Avro schema registry lookup on every message (adds ~0.5s)

Proposed optimizations can bring P95 to ~4.5s. Recommending we update the PRD SLA to 5s P95 with a note that peak-hour latency may reach 6s.

### Acceptance Criteria

- [x] Benchmark current pipeline latency for balance update events
- [x] Identify top 3 bottlenecks
- [ ] Implement Kafka consumer optimization
- [ ] Present findings to product team and agree on SLA

---

## PRD-007: Analytics Export

**Status:** In Development  
**Assignee:** Yemi Adeyemi  
**Sprint:** Sprint 47  
**Priority:** Medium

### Description

Allow customers to export their transaction and account data in CSV and Excel formats. This is the most-requested feature in the Q1 customer survey (requested by 67% of enterprise customers).

### Acceptance Criteria

- [x] CSV export for transactions (date range filter)
- [ ] Excel export for transactions
- [ ] CSV export for account summary
- [ ] Async export for large datasets (> 10k rows) with email notification when ready
- [ ] Export history page showing past exports

---

## SEC-201: Rotate all API keys older than 90 days

**Status:** Open  
**Assignee:** Unassigned  
**Sprint:** Backlog  
**Priority:** High

### Description

Security audit found 23 API keys that have not been rotated in over 90 days. Per our security policy, all API keys must be rotated every 90 days. This is a compliance requirement for SOC 2 Type II.

### Acceptance Criteria

- [ ] Identify all API keys older than 90 days
- [ ] Notify key owners 14 days before expiry
- [ ] Auto-expire keys at 90 days with a 7-day grace period
- [ ] Add key rotation reminder to the developer portal

---

## INFRA-55: Upgrade Kubernetes cluster to 1.30

**Status:** Open  
**Assignee:** Unassigned  
**Sprint:** Backlog  
**Priority:** Medium

### Description

Our Kubernetes cluster is running 1.27 which reaches end-of-life in June 2026. We need to upgrade to 1.30 before then.

### Acceptance Criteria

- [ ] Test upgrade in staging environment
- [ ] Verify all workloads are compatible with 1.30 API changes
- [ ] Schedule maintenance window for production upgrade
- [ ] Update runbook with rollback procedure
