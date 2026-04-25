# How-To Guides

## How to Set Up Your Local Development Environment

### Prerequisites

- macOS 12+ or Ubuntu 22.04+
- Node.js 20 LTS (use `nvm` to manage versions — run `nvm use` in the repo root)
- Docker Desktop 4.x
- Git configured with your work email (`git config --global user.email "you@acme.com"`)

### Step 1: Clone the repositories

```bash
git clone https://github.com/acme/platform.git
git clone https://github.com/acme/design-system.git  # optional, only if working on DS
```

### Step 2: Install dependencies

```bash
cd platform
nvm use          # reads .nvmrc, switches to Node 20
npm install
```

### Step 3: Set up environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the values. The secrets are in 1Password under "Engineering - Dev". The required variables are:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `STRIPE_SECRET_KEY` — Stripe test key (starts with `sk_test_`)
- `ELASTICSEARCH_URL` — Elasticsearch endpoint
- `JWT_SECRET` — Any random string for local dev

### Step 4: Start the local stack

```bash
docker compose up -d   # starts Postgres, Redis, Elasticsearch, and localstack
npm run dev            # starts the API on port 3001 and web app on port 3000
```

### Step 5: Seed the database

```bash
npm run db:seed
```

This creates demo accounts, sample transactions, and test users. The default admin login is `admin@acme-dev.com` / `devpassword123`.

### Troubleshooting

**Port 3000 already in use:** Run `lsof -i :3000` to find the process and kill it with `kill -9 <PID>`.

**Docker containers not starting:** Make sure Docker Desktop is running and you have at least 4GB RAM allocated in Docker settings.

**Database connection refused:** Run `docker compose ps` to verify the postgres container is healthy. If it's restarting, run `docker compose logs postgres` to see the error.

**`nvm: command not found`:** Install nvm from https://github.com/nvm-sh/nvm and restart your terminal.

**Elasticsearch not starting:** Elasticsearch requires `vm.max_map_count` to be at least 262144. On Linux: `sudo sysctl -w vm.max_map_count=262144`. On Mac with Docker Desktop, this is handled automatically.

---

## How to Submit a Pull Request

### Before You Start

- Make sure there is a JIRA ticket for your work. If not, create one in the appropriate project (ENG, DS, DATA, etc.)
- Branch from `main`: `git checkout main && git pull && git checkout -b feat/your-name/ENG-XXXX-short-description`

### Creating the PR

1. Push your branch: `git push -u origin your-branch-name`
2. Open a PR on GitHub. The PR template will auto-populate — fill in all sections.
3. Link the JIRA ticket: add `Closes ENG-XXXX` to the PR description
4. Add at least one reviewer. For shared infrastructure, add `@acme/platform-team`.
5. Make sure CI passes before requesting review. If CI is failing, fix it before pinging reviewers.

### PR Size Guidelines

- **Small (< 200 lines):** Can be reviewed same day
- **Medium (200–500 lines):** Allow 1 business day for review
- **Large (> 500 lines):** Break it up if possible. If not, schedule a review session with your reviewer.

### Merging

- Squash and merge is the default. Write a clean commit message: `feat(ENG-4460): add rate limiting to public API endpoints`
- Delete your branch after merging.
- If your change requires a database migration, coordinate with the on-call engineer before merging to main.

---

## How to Run and Write Tests

### Running Tests

```bash
npm test                        # run all tests
npm test -- --watch             # watch mode (re-runs on file change)
npm test -- src/auth            # run tests in a specific directory
npm test -- --coverage          # run with coverage report
npm run test:e2e                # run Playwright end-to-end tests
```

### Test Structure

We use **Jest** for unit and integration tests, and **Playwright** for end-to-end tests.

- Unit tests live next to the file they test: `src/utils/format.ts` → `src/utils/format.test.ts`
- Integration tests live in `src/__tests__/integration/`
- E2E tests live in `e2e/`

### Writing a Good Test

```typescript
describe('formatCurrency', () => {
  it('formats USD amounts with two decimal places', () => {
    expect(formatCurrency(1234.5, 'USD')).toBe('$1,234.50');
  });

  it('handles zero', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
  });

  it('handles negative amounts', () => {
    expect(formatCurrency(-50, 'USD')).toBe('-$50.00');
  });
});
```

### Coverage Requirements

We require **80% line coverage** for new code. CI will fail if coverage drops below this threshold. Run `npm run test:coverage` to check locally before pushing.

### Mocking External Services

Use `jest.mock()` for external services (Stripe, Slack, email). Never make real API calls in unit tests. Integration tests can use localstack for AWS services.

---

## How to Deploy to Staging

Staging deploys happen **automatically** when you merge to `main`. You do not need to do anything manually.

To verify your change is on staging:
1. Go to `https://staging.acme-internal.com`
2. Check the footer — it shows the current git SHA
3. Compare with your merged commit SHA on GitHub

If staging is broken after your merge, post in `#incidents` immediately and tag `@on-call`. Do not wait to see if it fixes itself.

---

## How to Deploy to Production

Production deploys require a manual approval step.

1. After your change is on staging and verified, go to the GitHub Actions tab
2. Find the "Deploy to Production" workflow run for your commit
3. Click "Review deployments" and approve
4. Monitor the deploy in `#releases` on Slack
5. After deploy, verify your change is working in production

**Never deploy on Fridays** unless it's a hotfix. If you're unsure, ask your manager.

---

## How to Access Logs and Monitoring

### Application Logs

Logs are in **Datadog**. Go to `https://app.datadoghq.com` and search by:
- Service name: `platform-api`, `platform-web`, `data-pipeline`
- Trace ID (from a Sentry error or a user report)
- User ID or request ID

For quick local debugging:
```bash
npm run dev 2>&1 | tee /tmp/dev.log
tail -f /tmp/dev.log | grep ERROR
```

### Error Tracking

We use **Sentry**. Errors are automatically captured and assigned to the team that owns the affected code. Check `https://sentry.io/acme` for your assigned issues. Set up Sentry notifications in your first week so you don't miss alerts.

### Metrics and Dashboards

Key dashboards in Datadog:
- **API Latency:** P50/P95/P99 by endpoint — bookmark this
- **Error Rate:** 5xx rate by service
- **Database:** Query time, connection pool usage, slow query log
- **Business Metrics:** DAU, transaction volume, revenue (read-only for engineers)
- **WebSocket:** Active connections, message throughput, reconnection rate

Alert thresholds: P99 latency > 2s or error rate > 1% triggers a PagerDuty alert to the on-call engineer.

---

## How to Use Feature Flags

We use **LaunchDarkly** for feature flags. Never ship a significant feature without a flag.

### Creating a Flag

1. Go to `https://app.launchdarkly.com/acme`
2. Create a new boolean flag with the naming convention: `feat-<ticket-id>-<short-description>` (e.g., `feat-eng-4421-websocket-dashboard`)
3. Default to `false` in production, `true` in development

### Using a Flag in Code

```typescript
import { ldClient } from '../lib/launchdarkly';

const isWebSocketEnabled = await ldClient.variation(
  'feat-eng-4421-websocket-dashboard',
  { key: user.id },
  false  // default value
);

if (isWebSocketEnabled) {
  // new WebSocket code path
} else {
  // old polling code path
}
```

### Cleaning Up Flags

Once a feature is fully rolled out and stable (usually 2 sprints after 100% rollout), remove the flag from the code and delete it from LaunchDarkly. Stale flags are a maintenance burden.

---

## How to Handle a Production Incident

### Immediate Response (first 5 minutes)

1. Acknowledge the PagerDuty alert
2. Post in `#incidents`: "Investigating [alert name]. Will update in 5 minutes."
3. Check Datadog for error rate and latency spikes
4. Check Sentry for new errors
5. Check recent deploys — was anything deployed in the last hour?

### Mitigation

- If a recent deploy caused the issue: roll back immediately using the GitHub Actions "Rollback" workflow
- If the issue is a database problem: check connection pool usage and slow query log
- If the issue is a third-party service: check their status page (Stripe: status.stripe.com, Slack: status.slack.com)

### Communication

- Update `#incidents` every 10 minutes with status
- If customer-facing impact lasts > 15 minutes, notify the customer success team
- After resolution, write a postmortem within 48 hours (template in Confluence)

### Postmortem

Every P0 and P1 incident requires a postmortem. The goal is learning, not blame. Include:
- Timeline of events
- Root cause
- What went well
- What could be improved
- Action items with owners and due dates
