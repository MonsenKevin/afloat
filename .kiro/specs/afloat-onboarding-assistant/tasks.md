# Implementation Plan: Afloat Onboarding Assistant Chrome Extension

## Overview

Incremental build ordered by dependency: shared types and DB schema first, then backend auth and API routes, then the Chrome Extension shell, then feature-by-feature (check-in, KB Q&A, GitHub blame, dashboard, manager view), and finally wiring + property tests. Each task produces runnable, integrated code before the next begins. Tasks marked `*` are optional stretch goals for the hackathon.

Estimated total: ~7 hours. Checkpoints are placed at natural demo-able milestones.

---

## Tasks

- [ ] 1. Project scaffolding and shared types
  - [ ] 1.1 Scaffold the backend: `npm init`, install `express`, `better-sqlite3`, `jsonwebtoken`, `bcrypt`, `openai`, `langchain`, `@langchain/openai`, `axios`, `dotenv`, `uuid`, `cors`; add `ts-node`, `typescript`, `jest`, `ts-jest`, `fast-check` as dev deps; create `tsconfig.json` and `jest.config.ts`
    - Output: `backend/` directory with `package.json`, `tsconfig.json`, `jest.config.ts`
    - _Requirements: 9.1_

  - [ ] 1.2 Scaffold the Chrome Extension: `npm create vite` with CRXJS plugin; install `react`, `react-dom`, `zustand`, `axios`, `recharts`, `tailwindcss`; configure `vite.config.ts` and `tailwind.config.js`
    - Output: `extension/` directory with `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`
    - _Requirements: 1.1, 1.2_

  - [ ] 1.3 Write the `manifest.json` (Manifest V3): declare `action`, `side_panel`, `storage`, `alarms`, `background` service worker, popup and side panel HTML entry points, CSP, and host permissions for `localhost` backend
    - _Requirements: 1.2, 1.3, 2.1_

  - [ ] 1.4 Define all shared TypeScript types in `extension/src/types/index.ts` and `backend/src/types/index.ts`: `User`, `Role`, `CheckIn`, `CheckInStatus`, `StruggleType`, `RoutingResult`, `CultureValue`, `CultureChampion`, `KBAnswer`, `ContactSuggestion`, `SentimentTrend`
    - Copy the interfaces verbatim from the design document
    - _Requirements: 3.5, 4.1, 5.3, 6.3_

- [ ] 2. Database schema and seed data
  - [x] 2.1 Create `backend/src/db/schema.sql` with all five tables (`users`, `checkins`, `culture_values`, `culture_champions`, `checkin_notes`) exactly as specified in the design; write `backend/src/db/index.ts` that opens the SQLite file, runs the schema, and exports the `db` singleton
    - _Requirements: 3.7, 8.1, 9.4_

  - [x] 2.2 Write `backend/src/db/seed.ts`: insert two demo users (one `New_Employee`, one `Manager` linked as their manager), three Amazon Leadership Principles as `culture_values`, and two `culture_champions` entries; load this seed on server startup when the DB is empty
    - _Requirements: 3.4, 4.2, 5.4_

  - [x] 2.3 Create `backend/data/kb/` directory with at least two markdown files: `amazon-leadership-principles.md` (covering Customer Obsession, Bias for Action, Ownership) and `engineering-onboarding.md` (covering repo setup, PR process, on-call rotation); these are the RAG source documents
    - _Requirements: 5.1, 5.4_

- [ ] 3. Backend auth
  - [x] 3.1 Implement `POST /api/auth/register` and `POST /api/auth/login` in `backend/src/routes/auth.ts`: hash passwords with `bcrypt`, sign JWTs with `jsonwebtoken`, return `{ token, user }` on success
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 3.2 Write `backend/src/middleware/auth.ts`: JWT verification middleware that attaches `req.user` (id, role, managerId) and returns 401 for missing/expired tokens and 403 for scope violations
    - _Requirements: 9.1, 9.6_

  - [ ]* 3.3 Write property test for authentication enforcement (Property 10)
    - **Property 10: Authentication Enforcement**
    - Generate arbitrary endpoint paths and JWT states (missing, expired, valid-wrong-user); assert 401 for missing/expired and 403 for valid-wrong-user
    - Tag: `// Feature: afloat-onboarding-assistant, Property 10: Authentication Enforcement`
    - **Validates: Requirements 9.1, 9.6**

- [ ] 4. Checkpoint — Auth smoke test
  - Start the backend (`ts-node src/index.ts`), call `POST /api/auth/register` and `POST /api/auth/login` with `curl` or a REST client, confirm JWT is returned and the middleware rejects requests without it.
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. LLM service and Knowledge Base RAG
  - [x] 5.1 Implement `backend/src/services/llm.ts`: export `generateCheckInQuestions(cultureValues)` and `classifyCheckIn(questions, responses, cultureValues)` using `openai` SDK with `response_format: { type: 'json_object' }` exactly as shown in the design
    - _Requirements: 3.3, 3.4, 4.1_

  - [x] 5.2 Implement `backend/src/services/vectorStore.ts`: `initVectorStore(docs)` loads markdown files from `./data/kb/`, splits with `RecursiveCharacterTextSplitter`, embeds with `OpenAIEmbeddings`, stores in `MemoryVectorStore`; `queryKB(question)` runs similarity search and synthesizes answer via GPT-4o-mini, always returning a citation
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.3 Call `initVectorStore()` during server startup in `backend/src/index.ts` before the server begins accepting requests
    - _Requirements: 5.1_

  - [ ]* 5.4 Write property test for KB answer citation completeness (Property 4)
    - **Property 4: KB Answer Citation Completeness**
    - Generate arbitrary vector store results with mock similarity scores; assert every returned `KBAnswer` has a non-empty `citation` string
    - Tag: `// Feature: afloat-onboarding-assistant, Property 4: KB Answer Citation Completeness`
    - **Validates: Requirements 5.3**

- [ ] 6. GitHub Blame service
  - [x] 6.1 Implement `backend/src/services/github.ts`: `getBlameContacts(repo, filePath)` calls `GET /repos/{org}/{repo}/commits?path={filePath}&per_page=10`, deduplicates by author login, sorts by `lastCommitDate` descending, returns up to 5 `ContactSuggestion` objects; if `GITHUB_TOKEN` is not set, load from `./data/github-mock.json` instead
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 6.2 Write property test for GitHub blame contact ordering and completeness (Property 5)
    - **Property 5: GitHub Blame Contact Completeness and Ordering**
    - Generate arbitrary arrays of commit objects with random ISO date strings; assert the returned list is sorted by `lastCommitDate` descending and every entry has non-empty `name`, `githubUsername`, and `lastCommitDate`
    - Tag: `// Feature: afloat-onboarding-assistant, Property 5: GitHub Blame Contact Completeness and Ordering`
    - **Validates: Requirements 6.2, 6.3**

- [ ] 7. Check-in API routes
  - [x] 7.1 Implement `GET /api/checkins/pending` in `backend/src/routes/checkins.ts`: query the `checkins` table for the authenticated employee's oldest `pending` check-in where `due_at <= now()`; return it or `null`
    - _Requirements: 3.1, 3.2_

  - [x] 7.2 Implement `POST /api/checkins/generate`: create a new `checkins` row with `status = 'pending'`, call `generateCheckInQuestions()`, persist the questions JSON, return `{ checkinId, questions }`
    - _Requirements: 3.3, 3.4_

  - [x] 7.3 Implement `POST /api/checkins/:id/submit`: validate the check-in belongs to the authenticated employee, call `classifyCheckIn()`, persist `sentimentScore`, `struggleType`, `responses`, `routing`, and `completedAt`; apply at-risk logic (flag employee if score < 3, increase frequency; clear flag after two consecutive ≥ 3; create manager notification if two consecutive < 2)
    - _Requirements: 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.3, 7.4, 7.5_

  - [x] 7.4 Implement `GET /api/checkins/history`: return all completed check-ins for the authenticated employee ordered by `completed_at` descending, including `sentimentScore`, `questions`, `responses`, and `routing`
    - _Requirements: 3.7, 8.1_

  - [ ]* 7.5 Write property test for sentiment score bounds (Property 1)
    - **Property 1: Sentiment Score Bounds**
    - Generate arbitrary arrays of string responses; mock the LLM to return a raw score from a wide numeric range; assert the persisted `sentimentScore` is always clamped to [1, 5]
    - Tag: `// Feature: afloat-onboarding-assistant, Property 1: Sentiment Score Bounds`
    - **Validates: Requirements 3.5**

  - [ ]* 7.6 Write property test for at-risk state machine invariant (Property 3)
    - **Property 3: At-Risk State Machine Invariant**
    - Generate arbitrary sequences of sentiment scores; run them through the at-risk transition logic; assert: flag set after any score < 3, flag cleared after two consecutive ≥ 3, manager notification exists after two consecutive < 2, check-in interval is 7 days while at-risk and 14 days otherwise
    - Tag: `// Feature: afloat-onboarding-assistant, Property 3: At-Risk State Machine Invariant`
    - **Validates: Requirements 7.1, 7.3, 7.4, 7.5**

  - [ ]* 7.7 Write property test for struggle routing completeness (Property 2)
    - **Property 2: Struggle Routing Completeness**
    - Generate arbitrary `ClassificationResult` objects with `HUMAN`, `TECHNICAL`, and `BOTH` struggle types and random implicated value lists; assert HUMAN results include champions tied to implicated values; assert TECHNICAL/BOTH results include at least one KB answer or GitHub contact
    - Tag: `// Feature: afloat-onboarding-assistant, Property 2: Struggle Routing Completeness`
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [ ] 8. KB and GitHub API routes
  - [x] 8.1 Implement `POST /api/kb/ask` in `backend/src/routes/kb.ts`: call `queryKB(question)`, return the `KBAnswer[]` or a "no results" message if the array is empty
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 8.2 Implement `POST /api/github/blame` in `backend/src/routes/github.ts`: extract `repo` and `filePath` from the request body, call `getBlameContacts()`, return `ContactSuggestion[]` or a descriptive error for 404/rate-limit responses
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 9. Manager API routes
  - [x] 9.1 Implement `GET /api/manager/reports` in `backend/src/routes/manager.ts`: verify `req.user.role === 'Manager'`, query all employees where `manager_id = req.user.id`, return each with their latest `sentimentScore` and an `atRisk` boolean
    - _Requirements: 9.5, 7.1_

  - [x] 9.2 Implement `GET /api/manager/reports/:id/trend`: verify the requested employee's `manager_id` matches the authenticated manager, return their full `SentimentTrend[]` array (no raw responses)
    - _Requirements: 9.5_

  - [ ]* 9.3 Write property test for role-based data isolation (Property 6)
    - **Property 6: Role-Based Data Isolation**
    - Generate pairs of distinct employee IDs; assert that querying history for employee A never returns rows where `employee_id = B`; assert manager trend endpoint returns 403 for employees not in their reports list
    - Tag: `// Feature: afloat-onboarding-assistant, Property 6: Role-Based Data Isolation`
    - **Validates: Requirements 9.4, 9.5, 9.6**

- [ ] 10. Checkpoint — Backend integration test
  - Run the full check-in flow against the live backend: register → login → generate check-in → submit responses → verify routing card JSON is returned; verify manager endpoint returns only direct reports.
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Chrome Extension shell and auth UI
  - [ ] 11.1 Create `extension/src/store/authStore.ts` (Zustand): `token`, `user`, `login(email, password)` (calls `POST /api/auth/login`, persists token to `chrome.storage.local`), `logout()`, `restoreSession()` (reads token from `chrome.storage.local` on mount)
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 11.2 Create `extension/src/api/client.ts`: axios instance with `baseURL` pointing to the backend, request interceptor that attaches `Authorization: Bearer <token>` from the auth store, response interceptor that calls `logout()` on 401
    - _Requirements: 9.3_

  - [ ] 11.3 Build `<LoginScreen />` component: email + password form, calls `authStore.login()`, shows error message on failure; render this as the root view when `token` is null
    - _Requirements: 9.1, 9.2_

  - [ ] 11.4 Build `<MainShell />`: tab bar with **Chat** and **Dashboard** tabs; conditionally show **Manager** tab when `user.role === 'Manager'`; include "Pin to Side Panel" button that calls `chrome.sidePanel.open({ windowId })`; render `displayMode` from Zustand to switch between popup (400px) and side panel (full-width) layout
    - _Requirements: 1.3, 2.1, 2.2, 2.5_

  - [ ] 11.5 Write `extension/src/background/background.ts`: create `checkin-reminder` alarm with `periodInMinutes: 20160` (14 days); on alarm fire, set badge text to `'1'` with red background; listen for `CLEAR_BADGE` message to clear the badge
    - _Requirements: 1.6, 3.1, 3.2_

- [ ] 12. Check-In UI flow
  - [ ] 12.1 Create `extension/src/store/checkinStore.ts` (Zustand): `pendingCheckin`, `currentResponses`, `routingResult`; actions: `fetchPending()`, `submitResponses(responses)`; persist `currentResponses` to `chrome.storage.local` so a partial check-in survives popup close
    - _Requirements: 1.4, 1.5, 3.5_

  - [ ] 12.2 Build `<CheckInFlow />`: stepper that renders one question at a time with a free-text input; "Next" advances the step; on the final question, "Submit" calls `checkinStore.submitResponses()`; show a loading state during submission
    - _Requirements: 3.3, 4.6_

  - [ ] 12.3 Build `<RoutingCard />`: rendered after check-in submission; displays the `RoutingResult` message, lists `CultureChampion` cards (name, value, bio) for HUMAN struggles, and `KBAnswer` cards (answer + citation) and `ContactSuggestion` cards (name, username, date) for TECHNICAL struggles
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ] 12.4 On `<App />` mount, call `checkinStore.fetchPending()`; if a pending check-in exists, render `<CheckInFlow />` as the default view instead of `<Chat />`; send `CLEAR_BADGE` message to the service worker after the check-in is submitted
    - _Requirements: 3.1, 3.2, 1.6_

- [ ] 13. Chat UI (KB Q&A + GitHub Blame)
  - [ ] 13.1 Create `extension/src/store/chatStore.ts` (Zustand): `messages` array (role + content), `sendMessage(text)` action; persist `messages` to `chrome.storage.local`; intent detection: if `text` matches a file path pattern (`/`, `.ts`, `.py`, `.js`, `src/`), call `POST /api/github/blame`; otherwise call `POST /api/kb/ask`
    - _Requirements: 1.4, 1.5, 5.1, 6.1_

  - [ ] 13.2 Build `<Chat />`: scrollable message thread, input box at the bottom, renders user messages right-aligned and Mission_Control responses left-aligned; KB answers show citation as a small grey tag below the answer; GitHub blame responses show a contact list with username and date
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3_

  - [ ]* 13.3 Write property test for conversation state round-trip (Property 8)
    - **Property 8: Conversation State Round-Trip**
    - Generate arbitrary `messages` arrays with random role/content strings; write to a `chrome.storage.local` mock, read back, assert deep equality — no fields dropped, no values mutated
    - Tag: `// Feature: afloat-onboarding-assistant, Property 8: Conversation State Round-Trip`
    - **Validates: Requirements 1.4, 1.5**

- [ ] 14. Employee Dashboard
  - [ ] 14.1 Build `<Dashboard />`: fetch `GET /api/checkins/history` on mount; render a Recharts `<LineChart />` with `SentimentTrend` data (x = date, y = score, y-domain [1, 5]); below the chart, render a list of past check-ins with date, score, and a collapsible response detail section
    - _Requirements: 8.1, 8.2_

  - [ ] 14.2 Add inline note editor to each check-in row in `<Dashboard />`: clicking "Add note" shows a `<textarea>`; on save, call `POST /api/checkins/:id/notes` (add this route to the backend: insert into `checkin_notes`, return the saved note); display saved notes below the check-in entry
    - _Requirements: 8.3_

  - [ ]* 14.3 Write property test for check-in history completeness (Property 9)
    - **Property 9: Check-In History Completeness**
    - Generate an arbitrary number N of completed check-in rows in the test DB; call `GET /api/checkins/history`; assert the response contains exactly N entries each with non-null `completedAt`, `sentimentScore`, and `responses`; assert the trend array also has exactly N points
    - Tag: `// Feature: afloat-onboarding-assistant, Property 9: Check-In History Completeness`
    - **Validates: Requirements 3.7, 8.1, 8.2**

- [ ] 15. Manager View
  - [ ] 15.1 Build `<ManagerView />`: fetch `GET /api/manager/reports` on mount; render a list of direct reports showing name, latest sentiment score, and a red "At Risk" badge when `atRisk === true`; clicking a report fetches `GET /api/manager/reports/:id/trend` and renders a Recharts `<LineChart />` in a modal or expanded row
    - _Requirements: 9.5, 7.1, 7.5_

- [ ] 16. Proactive at-risk outreach UI
  - [ ] 16.1 On `<App />` mount (after auth restore), call `GET /api/checkins/pending`; if the response includes an `atRisk: true` flag on the user object (add this field to the `/api/auth/login` response and the user record), render a `<ProactiveOutreachBanner />` above the main content showing the routing message and at least one suggested resource
    - _Requirements: 7.2, 7.3_

- [ ] 17. Checkpoint — Full end-to-end demo flow
  - Load the extension in Chrome developer mode; log in as the demo New_Employee; trigger a check-in by setting `due_at` to a past timestamp in the DB; complete the check-in; verify the routing card, badge clearing, and dashboard trend line all work; log in as the Manager and verify the reports list.
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Wiring and polish
  - [ ] 18.1 Wire the Side Panel: create `extension/src/sidepanel/main.tsx` that mounts the same `<App />` root component; add `sidepanel.html` entry point; verify `chrome.sidePanel.open()` from the popup opens the side panel and the popup closes; verify all features work identically in side panel mode
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 18.2 Add the 48-hour follow-up reminder: in the background service worker, create a second alarm `checkin-followup` set 48 hours after a check-in is generated (store the due timestamp in `chrome.storage.local`); on fire, increment the badge count and store a reminder flag; on next popup open, display a reminder message if the flag is set
    - _Requirements: 3.6_

  - [ ]* 18.3 Write property test for check-in question coverage (Property 7)
    - **Property 7: Check-In Question Coverage**
    - Generate arbitrary arrays of `CultureValue` objects; call `generateCheckInQuestions()` with a mocked LLM that returns questions referencing the input values; assert at least one question names a culture value, at least one asks about team belonging, and at least one asks about technical progress
    - Tag: `// Feature: afloat-onboarding-assistant, Property 7: Check-In Question Coverage`
    - **Validates: Requirements 3.3, 3.4**

- [ ] 19. Final checkpoint — All tests green
  - Run `jest --runInBand` in the backend; confirm all unit tests and any implemented property tests pass.
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP demo. Core functionality (tasks 1–17 non-starred) is the primary 7-hour target.
- Each task references specific requirements for traceability.
- Property tests use `fast-check` with a minimum of 100 iterations per property.
- The `./data/github-mock.json` fallback means GitHub Blame works in the demo even without a real PAT.
- The in-memory vector store is re-seeded from `./data/kb/` on every server restart — no external service needed.
- Checkpoints at tasks 4, 10, 17, and 19 are natural demo-able milestones and good places to pause and verify progress.
