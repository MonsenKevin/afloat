# Engineering Onboarding Guide

## Getting Started

### Repository Setup

1. Clone the main monorepo: `git clone https://github.com/acme/platform.git`
2. Install dependencies: `npm install` (Node 20 LTS required — use `nvm use` to switch)
3. Copy `.env.example` to `.env.local` and fill in your credentials (ask your manager for the secrets, or find them in 1Password under "Engineering - Dev")
4. Run the dev server: `npm run dev`

### Key Repositories

- **platform** — Main monorepo containing all services and the web app
- **infra** — Terraform and Kubernetes infrastructure definitions
- **design-system** — Shared React component library (`@acme/design-system`)
- **data-pipelines** — Kafka consumers, ETL jobs, and analytics pipelines
- **mobile** — React Native app (iOS and Android)

### Development Environment

We use VS Code with the following required extensions:
- ESLint
- Prettier
- GitLens
- Docker
- Thunder Client (for API testing)

Recommended: install `direnv` to auto-load `.env.local` when you `cd` into the repo.

### First Week Checklist

- [ ] Dev environment set up and `npm run dev` working
- [ ] First PR opened (even a docs fix counts)
- [ ] Met with your manager for a 1:1
- [ ] Joined the relevant Slack channels (see list below)
- [ ] Read the team charter (pinned in your team's Slack channel)
- [ ] Shadowed an on-call shift
- [ ] Met your assigned mentor

## Pull Request Process

### Creating a PR

1. Branch from `main` using the format: `feat/your-name/ticket-id-short-description` or `fix/your-name/ticket-id-short-description`
2. Keep PRs small — aim for under 400 lines of diff. Large PRs get fewer reviews and more bugs slip through.
3. Write a clear PR description using the template (auto-populated when you open a PR on GitHub)
4. Link the JIRA ticket: add `Closes ENG-XXXX` to the PR description
5. Add at least one reviewer from your team. For shared infrastructure changes, add `@acme/platform-team`

### PR Review Standards

- Respond to review comments within 24 hours
- Resolve all comments before merging (or explicitly mark as "won't fix" with a reason)
- Squash commits before merging to keep history clean
- PRs require at least 1 approval and passing CI
- Use the comment prefixes: `nit:` (style, non-blocking), `suggestion:` (improvement, non-blocking), `question:` (seeking understanding), `blocker:` (must fix before merge)

### CI/CD Pipeline

All PRs run automatically:
- Unit tests (`npm test`)
- Lint (`npm run lint`)
- Type check (`npm run typecheck`)
- Build verification
- Security scan (Snyk)

Merges to `main` automatically deploy to **staging**. Production deploys require a manual approval step in GitHub Actions — your manager or a senior engineer must approve.

### Hotfix Process

For urgent production fixes:
1. Branch from the latest production tag: `git checkout -b hotfix/your-name/description v1.4.3`
2. Make the minimal fix
3. Open a PR targeting `main` with the `hotfix` label
4. Tag `@on-call` in the PR for expedited review
5. After merge, the on-call engineer will coordinate the production deploy

## On-Call Rotation

### How It Works

Each team has a weekly on-call rotation. You will join the rotation after your first **60 days**.

- **Primary on-call**: Responds to all P0/P1 alerts within 15 minutes
- **Secondary on-call**: Backup if primary is unavailable; also handles P2 alerts

Alerts come via PagerDuty. Make sure the PagerDuty app is installed on your phone before you go on-call.

### Escalation Path

1. Check the runbook in Confluence for the alerting service
2. If no runbook exists or the issue is novel, page the secondary on-call
3. For customer-impacting issues (P0), notify `#incidents` on Slack immediately
4. If the issue is not resolved within 30 minutes, escalate to your manager

### Runbooks

All runbooks live in Confluence under **Engineering > Runbooks**. If you fix an issue and there is no runbook, write one — this is the Ownership principle in action.

### Alert Severity Levels

- **P0** — Production down or data loss. All hands. Respond in 5 minutes.
- **P1** — Major feature broken, significant customer impact. Respond in 15 minutes.
- **P2** — Degraded performance or minor feature broken. Respond in 2 hours.
- **P3** — Non-urgent issue, no customer impact. Handle during business hours.

## Team Practices

### Meetings

- **Daily standup**: 9:30 AM PT, 15 minutes, async-first (post in `#standup` if you can't attend live)
- **Sprint planning**: Every other Monday, 1 hour
- **Retrospective**: Every other Friday, 45 minutes
- **1:1 with manager**: Weekly, 30 minutes — your manager will set this up in your first week
- **All-hands**: Monthly, 1 hour — company-wide updates from leadership

### Communication

- Use Slack for async communication; prefer public channels over DMs for work discussions
- Use email for external communication and formal announcements
- Tag people with `@` only when you need their attention; use `@here` sparingly
- Default to over-communicating when you're blocked — a quick Slack message saves hours

### Code Review Culture

We practice kind, direct code review. Feedback should be about the code, not the person.

**Giving feedback:**
- Be specific: reference the exact line and explain why
- Suggest an alternative when you flag a problem
- Acknowledge good work — a `+1` or "nice approach here" goes a long way

**Receiving feedback:**
- Assume positive intent
- Ask for clarification if a comment is unclear
- It's okay to disagree — explain your reasoning and discuss

## Getting Help

### Who to Ask

- **Technical questions about a specific file**: Use `git blame` to find recent contributors, or ask in `#engineering-help`
- **Process questions**: Ask in `#engineering-help` on Slack
- **Culture and values questions**: Talk to your manager or a Culture Champion (see the Culture Champions list in Confluence)
- **HR and benefits**: Contact hr@acme.com or use the HR portal at hr.acme-internal.com
- **Security concerns**: Email security@acme.com or use the anonymous reporting form

### Useful Slack Channels

- `#engineering-help` — General engineering questions, no question is too basic
- `#incidents` — Active incidents and postmortems
- `#releases` — Deployment announcements
- `#random` — Non-work chat
- `#new-employees` — Questions and community for new hires (very active, very welcoming)
- `#design-system` — Questions about `@acme/design-system` components
- `#platform-api` — Questions about the platform API
- `#data-pipelines` — Questions about Kafka, ETL, and analytics

### 1Password Vaults

- **Engineering - Dev**: Local development secrets (DATABASE_URL, REDIS_URL, Stripe test keys)
- **Engineering - Staging**: Staging environment secrets (ask your manager for access)
- **Engineering - Prod**: Production secrets (restricted to senior engineers and on-call)

## Architecture Overview

### System Components

```
Browser / Mobile App
       ↓
   CDN (CloudFront)
       ↓
  Platform API (Node.js / Express)
       ↓
  ┌────────────────────────────┐
  │  PostgreSQL (primary data) │
  │  Redis (cache + queues)    │
  │  Elasticsearch (search)    │
  └────────────────────────────┘
       ↓
  Data Pipeline (Kafka → consumers)
       ↓
  Analytics DB (ClickHouse)
```

### Key Design Decisions

- **Monorepo**: All services in one repo for easier cross-service refactoring
- **REST + WebSocket**: REST for CRUD, WebSocket for real-time updates
- **Redis for rate limiting and idempotency**: Shared state across API instances
- **Cursor-based pagination**: For large datasets (transactions, audit logs)
- **Feature flags**: Use LaunchDarkly for gradual rollouts — never ship a big feature without a flag
