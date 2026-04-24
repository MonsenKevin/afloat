# Engineering Onboarding Guide

## Getting Started

### Repository Setup

1. Clone the main monorepo: `git clone https://github.com/acme/platform.git`
2. Install dependencies: `npm install` (Node 18+ required)
3. Copy `.env.example` to `.env.local` and fill in your credentials (ask your manager for the secrets)
4. Run the dev server: `npm run dev`

### Key Repositories

- **platform** — Main monorepo containing all services
- **infra** — Terraform infrastructure definitions
- **design-system** — Shared React component library
- **data-pipelines** — ETL and analytics pipelines

### Development Environment

We use VS Code with the following required extensions:
- ESLint
- Prettier
- GitLens
- Docker

## Pull Request Process

### Creating a PR

1. Branch from `main` using the format: `feat/your-name/short-description` or `fix/your-name/short-description`
2. Keep PRs small — aim for under 400 lines of diff
3. Write a clear PR description using the template (auto-populated when you open a PR)
4. Add at least one reviewer from your team

### PR Review Standards

- Respond to review comments within 24 hours
- Resolve all comments before merging
- Squash commits before merging to keep history clean
- PRs require at least 1 approval and passing CI

### CI/CD Pipeline

All PRs run:
- Unit tests (`npm test`)
- Lint (`npm run lint`)
- Type check (`npm run typecheck`)
- Build verification

Merges to `main` automatically deploy to staging. Production deploys require a manual approval step.

## On-Call Rotation

### How It Works

Each team has a weekly on-call rotation. You will join the rotation after your first 60 days.

- **Primary on-call**: Responds to all P0/P1 alerts within 15 minutes
- **Secondary on-call**: Backup if primary is unavailable

### Escalation Path

1. Check the runbook in Confluence for the alerting service
2. If no runbook exists or the issue is novel, page the secondary on-call
3. For customer-impacting issues, notify the #incidents Slack channel immediately

### Runbooks

All runbooks live in Confluence under Engineering > Runbooks. If you fix an issue and there is no runbook, write one — this is an Ownership principle in action.

## Team Practices

### Meetings

- **Daily standup**: 9:30 AM PT, 15 minutes, async-first (post in #standup if you can't attend)
- **Sprint planning**: Every other Monday, 1 hour
- **Retrospective**: Every other Friday, 45 minutes
- **1:1 with manager**: Weekly, 30 minutes

### Communication

- Use Slack for async communication; prefer public channels over DMs for work discussions
- Use email for external communication and formal announcements
- Tag people with `@` only when you need their attention; use `@here` sparingly

### Code Review Culture

We practice kind, direct code review. Feedback should be about the code, not the person. Use the following prefixes:
- `nit:` — minor style preference, not blocking
- `suggestion:` — improvement idea, not blocking
- `question:` — seeking understanding, not blocking
- `blocker:` — must be addressed before merge

## Getting Help

### Who to Ask

- **Technical questions about a specific file or service**: Use `git blame` to find recent contributors
- **Process questions**: Ask in #engineering-help on Slack
- **Culture and values questions**: Talk to your manager or a Culture Champion
- **HR and benefits**: Contact hr@acme.com

### Useful Slack Channels

- `#engineering-help` — General engineering questions
- `#incidents` — Active incidents and postmortems
- `#releases` — Deployment announcements
- `#random` — Non-work chat
- `#new-employees` — Questions and community for new hires
