# Architecture and Security Guide

## System Architecture

### Overview

Acme's platform is a multi-tenant SaaS application serving financial data to business customers. The system is built on a Node.js/Express API backend, a React/Next.js frontend, and a Kafka-based data pipeline.

### Core Services

| Service | Language | Repo | Owner |
|---|---|---|---|
| Platform API | Node.js / TypeScript | platform | Marcus Webb |
| Web App | React / Next.js | platform | Priyanka Nair |
| Data Pipeline | Node.js / TypeScript | data-pipelines | Ben Hartley |
| Design System | React / TypeScript | design-system | Priyanka Nair |
| Infrastructure | Terraform / Kubernetes | infra | Marcus Webb |

### Data Flow

1. **Customer actions** (web or mobile) hit the Platform API via HTTPS
2. **API** validates auth, processes the request, writes to PostgreSQL
3. **PostgreSQL triggers** publish change events to Kafka
4. **Kafka consumers** (data-pipelines) process events and update ClickHouse for analytics
5. **WebSocket server** subscribes to Kafka topics and pushes real-time updates to connected clients

### Database Architecture

- **PostgreSQL** — Primary transactional database. All writes go here first.
- **Redis** — Cache layer, rate limiting state, idempotency keys, session storage
- **Elasticsearch** — Full-text search index for customers, transactions, and support tickets
- **ClickHouse** — Analytics database for aggregated metrics and reporting

### Authentication

We use JWT tokens with ES256 signing (migrating from RS256 — see ENG-4455). Tokens expire after 24 hours. Refresh tokens are stored in Redis with a 30-day TTL.

Service-to-service calls use short-lived tokens (1 hour TTL) signed with a separate service account key.

### Rate Limiting

Public API endpoints are rate limited at 1,000 requests per minute per API key (ENG-4460). Rate limit state is stored in Redis using the token bucket algorithm. Internal service-to-service calls are exempt.

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the window resets

## Security Practices

### Secrets Management

- **Never commit secrets to git.** Use `.env.local` for local development (gitignored).
- All production secrets are stored in AWS Secrets Manager.
- Secrets are rotated every 90 days (enforced by SEC-201).
- Use 1Password for sharing secrets with teammates — never send secrets over Slack or email.

### API Key Security

- API keys are hashed before storage (SHA-256). We never store plaintext keys.
- Keys are displayed only once at creation time.
- Keys older than 90 days are automatically expired (SEC-201).
- If you suspect a key has been compromised, rotate it immediately and notify security@acme.com.

### Input Validation

All API inputs are validated using Zod schemas before processing. Never trust user input. Validate:
- Type (string, number, boolean)
- Format (email, UUID, ISO date)
- Length (prevent oversized payloads)
- Allowed values (enums)

### SQL Injection Prevention

We use parameterized queries exclusively. Never concatenate user input into SQL strings.

```typescript
// ✅ Safe
db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// ❌ Never do this
db.exec(`SELECT * FROM users WHERE id = '${userId}'`);
```

### CORS Policy

The API allows requests from:
- `https://app.acme.com` (production)
- `https://staging.acme-internal.com` (staging)
- `http://localhost:3000` (local development only)

All other origins are rejected.

### Dependency Security

- We use Snyk to scan dependencies for vulnerabilities on every PR
- Critical vulnerabilities must be patched within 24 hours
- High vulnerabilities must be patched within 7 days
- Run `npm audit` locally before pushing if you've added new dependencies

### Logging and PII

**Never log PII.** This includes:
- Email addresses
- Phone numbers
- Social Security Numbers
- Credit card numbers
- Full names (use user IDs instead)

If you need to debug a user issue, use their user ID. If you need to see their email, look it up in the admin portal — don't add it to logs.

## Infrastructure

### Kubernetes

We run on AWS EKS (Kubernetes). The cluster is currently on version 1.27 (upgrade to 1.30 planned — INFRA-55).

Key namespaces:
- `platform` — API and web app
- `data` — Kafka, consumers, ClickHouse
- `monitoring` — Datadog agents, Prometheus

### Deployment

- **Staging**: Auto-deploys on merge to `main` via GitHub Actions
- **Production**: Manual approval required in GitHub Actions
- **Rollback**: Use the "Rollback" workflow in GitHub Actions — it redeploys the previous image tag

### Scaling

The Platform API scales horizontally. Redis handles shared state (rate limiting, sessions) so any instance can handle any request. The API is stateless.

Auto-scaling is configured to add instances when CPU > 70% or memory > 80%. Minimum 2 instances in production at all times.

### Disaster Recovery

- PostgreSQL: Daily automated backups to S3, point-in-time recovery enabled (30-day retention)
- Redis: AOF persistence enabled, replicated across 2 availability zones
- RTO (Recovery Time Objective): 4 hours
- RPO (Recovery Point Objective): 1 hour

The DR runbook is in Confluence under Engineering > Runbooks > Disaster Recovery.
