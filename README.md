# Afloat

**AI-powered onboarding co-pilot for new employees.**

Afloat helps new hires get up to speed faster by giving them a friendly check-in experience, answering questions from the company knowledge base, and surfacing the right people to talk to — all from a Chrome extension.

Built at the Kiro AI Spark Challenge Hackathon.

---

## What it does

- **Biweekly check-ins** — employees rate company values and share how they're doing technically and culturally. Takes about 2 minutes.
- **AI routing** — Claude analyzes responses and routes employees to culture champions (for human struggles) or knowledge base answers and GitHub file contributors (for technical blockers).
- **Ask anything** — a persistent chat interface powered by Claude that can search the company knowledge base, Jira tickets, GitHub, Google Calendar, Outlook, and meeting notes.
- **Manager dashboard** — managers see team sentiment trends, can request peer reviews, and leave coaching notes.
- **Org integrations** — connect Jira, GitHub, Google Calendar, Outlook, and Granola to enrich answers with real context from your company's tools.

---

## Architecture

```
afloat/
├── backend/          # Express API + SQLite + Claude
└── extension/        # Chrome Extension (React + Tailwind)
```

### Backend

- **Runtime:** Node.js + TypeScript
- **Framework:** Express
- **Database:** SQLite (via sql.js, file-backed)
- **AI:** Anthropic Claude (`claude-3-5-haiku`) for check-in classification, KB search, and chat
- **Auth:** JWT + bcrypt
- **Integrations:** Jira, GitHub, Google Calendar, Outlook, Granola — synced on a scheduler and indexed for search

### Extension

- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **Styling:** Tailwind CSS
- **State:** Zustand
- **Charts:** Recharts

---

## Getting started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Backend

```bash
cd backend
npm install
```

Copy the example env and fill in your keys:

```bash
cp .env.example .env
```

Required env vars:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `JWT_SECRET` | Any random secret string |
| `ENCRYPTION_KEY` | 64-char hex string for credential encryption |
| `PORT` | Server port (default `3001`) |

Optional (for live integrations):

| Variable | Description |
|---|---|
| `GITHUB_TOKEN` | GitHub personal access token |
| `GITHUB_ORG` | GitHub organization name |

Start the dev server:

```bash
npm run dev
```

The API will be available at `http://localhost:3001`.

### 2. Chrome Extension

```bash
cd extension
npm install
npm run build
```

Then load the extension in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/dist` folder

---

## Seeded accounts

The backend seeds demo accounts on first run:

| Role | Email | Password |
|---|---|---|
| New Employee | `alice@acme.com` | `password123` |
| New Employee | `bob@acme.com` | `password123` |
| Manager | `carol@acme.com` | `password123` |

---

## API routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login |
| `GET` | `/api/checkins/pending` | Get pending check-in |
| `POST` | `/api/checkins/:id/submit` | Submit check-in responses |
| `GET` | `/api/checkins/history` | Employee check-in history |
| `GET` | `/api/kb/search?q=` | Search knowledge base |
| `GET` | `/api/github/contributors` | Get file contributors |
| `GET` | `/api/manager/team` | Manager team overview |
| `GET` | `/api/integrations` | List org integrations |
| `POST` | `/api/integrations` | Add integration |

---

## Knowledge base

Drop markdown files into `backend/data/kb/` and they'll be loaded automatically on server start. The included KB covers:

- Amazon leadership principles
- Engineering onboarding guide
- Architecture & security docs
- How-to guides
- Jira ticket summaries
- Product requirements
- Team culture guide

---

## Tech stack summary

| Layer | Tech |
|---|---|
| AI | Anthropic Claude |
| API | Express + TypeScript |
| Database | SQLite (sql.js) |
| Auth | JWT + bcrypt |
| Extension | React + Vite + Tailwind |
| State | Zustand |
| Charts | Recharts |
