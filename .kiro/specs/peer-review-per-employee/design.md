# Design Document: Peer Review Per Employee

## Overview

This feature reorganizes the manager view so that peer reviews appear underneath each employee (the subject) rather than in a separate flat list at the bottom of the page. It also introduces an aggregated **peer score** — the arithmetic mean of all slider question responses across all approved peer reviews for a given employee — so the manager can compare it directly against the employee's self-assessment score (from check-ins).

### Current Layout

```
Direct Reports
  ├── Alice  [score: 4.2]  [Trend] [Check-ins]
  ├── Bob    [score: 3.1]  [Trend] [Check-ins]
  └── Carol  [score: 4.8]  [Trend] [Check-ins]

Peer Reviews (flat list, all employees mixed)
  ├── Bob → Alice  [Needs Approval]
  ├── Carol → Bob  [Awaiting Review]
  └── Alice → Carol [Approved]
```

### New Layout

```
Direct Reports
  ├── Alice  [self: 4.2]  [peer: 3.9]  [Trend] [Check-ins] [Peer Reviews ▼]
  │     └── Bob → Alice  [Approved]  (expandable responses)
  ├── Bob    [self: 3.1]  [peer: —]   [Trend] [Check-ins] [Peer Reviews ▼]
  │     └── (no peer feedback yet)
  └── Carol  [self: 4.8]  [peer: 4.5]  [Trend] [Check-ins] [Peer Reviews ▼]
        └── Alice → Carol [Approved]  (expandable responses)

[+ Assign Peer Review]   ← assign form stays at top level
Pending Reviews (non-approved, for manager action)
  └── Carol → Bob  [Needs Approval]  [Review & Approve]
```

The assign form and the approval workflow for `pending_manager` reviews remain at the top level so the manager can act on them without navigating into an employee card.

---

## Architecture

The system is a Chrome extension (React) backed by an Express/SQLite API. This feature touches:

- **Backend route** (`backend/src/routes/manager.ts`) — `GET /api/manager/reports` gains a `peerScore` field per employee, computed inline via a SQL subquery.
- **Frontend component** (`extension/src/components/Manager/ManagerView.tsx`) — restructured to group approved peer reviews by `subject_id` and render them under each employee card. Pending reviews remain in a separate action queue.
- **Frontend types** (`extension/src/types/index.ts`) — `Report` interface gains `peerScore: number | null`.

No new tables, no new routes, no new services. The change is additive on the backend (one extra field) and structural on the frontend (re-grouping existing data).

---

## Components and Interfaces

### Backend Changes

#### `GET /api/manager/reports` — add `peerScore` per employee

The existing query fetches each direct report and their latest check-in score. We extend it to also compute the peer score inline:

```typescript
// For each employee, compute peer score from approved reviews
const peerScoreRow = db.prepare(`
  SELECT AVG(CAST(json_each.value AS REAL)) as peer_score
  FROM peer_reviews pr,
       json_each(pr.responses)
  WHERE pr.subject_id = ?
    AND pr.manager_id = ?
    AND pr.status = 'approved'
    AND json_each.key IN (
      SELECT key FROM json_each(pr.questions)
      WHERE json_each.value LIKE 'slider:%'
    )
`).get(emp.id, managerId) as any;
```

> **Note on SQL approach**: SQLite's `json_each` lets us iterate over the JSON arrays inline. The slider questions are identified by the `slider:` prefix (same convention used throughout the codebase). We average only the numeric responses that correspond to slider questions.

The response shape for each report gains one field:

```typescript
{
  id: string;
  email: string;
  name: string;
  startDate: string;
  atRisk: boolean;
  latestSentimentScore: number | null;   // existing
  peerScore: number | null;              // NEW — null if no approved reviews
}
```

The `peerScore` is rounded to one decimal place in the route handler before returning.

#### No new endpoints

Peer reviews are already returned by `GET /api/manager/peer-reviews`. The frontend will continue to call this endpoint and group the results client-side by `subject_id`.

### Frontend Changes

#### `ManagerView.tsx` — structural reorganisation

**State additions:**

```typescript
// Derived from peerReviews state — computed on every render
const approvedBySubject: Record<string, ManagerPeerReview[]> = {};
const pendingReviews: ManagerPeerReview[] = [];

for (const pr of peerReviews) {
  if (pr.status === 'approved') {
    if (!approvedBySubject[pr.subjectId]) approvedBySubject[pr.subjectId] = [];
    approvedBySubject[pr.subjectId].push(pr);
  } else {
    pendingReviews.push(pr);
  }
}
```

**Per-employee card** gains:
- A `peerScore` display next to `latestSentimentScore` (both shown as `ScorePill` with a label)
- A "Peer Reviews" toggle button (alongside existing Trend / Check-ins buttons)
- When expanded: a list of approved peer reviews for that employee, each expandable to show full responses

**Top-level section** retains:
- The `+ Assign Peer Review` button and form
- A "Pending Reviews" sub-section listing only `pending_reviewer` and `pending_manager` reviews (for manager action)

**`Report` interface update** (frontend types):

```typescript
interface Report {
  id: string;
  name: string;
  email: string;
  latestSentimentScore: number | null;
  peerScore: number | null;              // NEW
  atRisk: boolean;
  startDate: string;
}
```

**Score display** — both scores use the same `ScorePill` component and the same color thresholds (≥4 green, ≥3 yellow, <3 red). Labels distinguish them:

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
  {report.latestSentimentScore !== null && (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ fontSize: 9, color: '#9ca3af', marginBottom: 1 }}>self</span>
      <ScorePill score={report.latestSentimentScore} />
    </div>
  )}
  {report.peerScore !== null && (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ fontSize: 9, color: '#9ca3af', marginBottom: 1 }}>peer</span>
      <ScorePill score={report.peerScore} />
    </div>
  )}
</div>
```

#### `expandedSection` type update

The existing `ExpandedSection` type is extended:

```typescript
type ExpandedSection = 'trend' | 'checkins' | 'peerreviews' | null;
```

No new async data fetching is needed for the peer reviews section — the data is already loaded from `GET /api/manager/peer-reviews` on mount.

---

## Data Models

### `peer_reviews` table — no changes

The schema is unchanged. The `status` field values (`pending_reviewer`, `pending_manager`, `approved`) remain as-is.

### Peer score calculation

The peer score is the arithmetic mean of all numeric slider responses across all approved peer reviews for a subject:

```
peerScore = mean({ response[i] : question[i] starts with "slider:", review.status = "approved" })
```

Where responses are stored as a JSON array parallel to the questions array. Slider responses are integers 1–5 (stored as strings in JSON, cast to REAL in SQL).

**Example:**

| Review | Slider responses |
|--------|-----------------|
| Review A (approved) | [4, 3, 5] |
| Review B (approved) | [3, 4, 4] |
| Review C (pending)  | [5, 5, 5] — excluded |

`peerScore = (4+3+5+3+4+4) / 6 = 23/6 ≈ 3.8`

### Frontend grouping

Client-side grouping is a pure transformation of the `peerReviews` array:

```
approvedBySubject: Record<subjectId, ManagerPeerReview[]>
```

Computed on every render (no memoization needed at this scale — teams up to 20 employees with a handful of reviews each).

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Peer score calculation correctness

*For any* employee with any set of approved peer reviews (including zero), the `peerScore` returned by `GET /api/manager/reports` SHALL equal the arithmetic mean of all slider question responses across only the approved reviews, rounded to one decimal place — and SHALL be `null` when there are no approved reviews.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 4.5, 5.2**

### Property 2: Peer reviews grouped correctly by subject

*For any* array of peer reviews with varying `subject_id` values and statuses, the client-side grouping function SHALL produce groups where every review in `approvedBySubject[subjectId]` has `subjectId === subjectId` and `status === 'approved'`, and no non-approved review appears in any group.

**Validates: Requirements 1.2, 4.4**

### Property 3: Reports response shape includes all required fields

*For any* manager with any number of direct reports (including zero), the response from `GET /api/manager/reports` SHALL include a `peerScore` field (either a number or `null`) alongside `name`, `email`, and `latestSentimentScore` for every report in the array.

**Validates: Requirements 5.1, 5.3**

### Property 4: Manager data isolation

*For any* two distinct managers each with their own set of direct reports, the response from `GET /api/manager/reports` for manager A SHALL contain only employees whose `manager_id` equals manager A's id, and SHALL NOT contain any employee belonging to manager B.

**Validates: Requirements 5.4**

### Property 5: Reviewer name and date always rendered

*For any* approved peer review with any reviewer name and any completion date, the rendered peer review entry under the subject employee SHALL contain the reviewer's name and the formatted completion date.

**Validates: Requirements 7.1**

### Property 6: All responses displayed when expanded

*For any* approved peer review with any combination of slider and text responses, when the review is expanded in the UI, the rendered output SHALL display every response (both slider bars and text answers) with no omissions.

**Validates: Requirements 7.3**

### Property 7: Manager notes displayed if and only if non-null

*For any* approved peer review, the rendered peer review entry SHALL display the manager notes section if and only if `managerNotes` is a non-null, non-empty string.

**Validates: Requirements 7.4**

### Property 8: Peer reviews in reverse chronological order

*For any* employee with any set of approved peer reviews with varying `completedAt` timestamps, the reviews SHALL be rendered in descending order of `completedAt` (newest first).

**Validates: Requirements 7.5**

### Property 9: Consistent color coding across score types

*For any* score value in [1, 5], the `ScorePill` component SHALL apply the same background color and text color regardless of whether the score represents a self-assessment or a peer score.

**Validates: Requirements 3.5**

### Property 10: Peer review count equals actual approved count

*For any* employee with any number of approved peer reviews, the count displayed in the employee card's peer reviews section SHALL equal the length of the `approvedBySubject[employee.id]` array.

**Validates: Requirements 1.4**

---

## Error Handling

### Backend

| Scenario | Response |
|---|---|
| Manager requests reports with no direct reports | `{ reports: [] }` — empty array, HTTP 200 |
| Peer score SQL fails (malformed JSON in responses) | Gracefully returns `null` for `peerScore`; the employee row is still included |
| Unauthenticated request | `401` (handled by `requireAuth` middleware, unchanged) |
| Non-manager requests reports | `403` (handled by `requireManager` middleware, unchanged) |

The peer score calculation uses `AVG()` which returns `NULL` in SQL when there are no matching rows — this maps naturally to `null` in the JSON response.

### Frontend

| Scenario | Behavior |
|---|---|
| `GET /api/manager/reports` fails | Existing error handling (silent catch, empty list shown) |
| `GET /api/manager/peer-reviews` fails | Silent catch; `approvedBySubject` is empty, each employee shows "no peer feedback" |
| Employee has `peerScore: null` | Peer score pill is not rendered; only self-assessment score shown (or neither if both null) |
| Employee has `latestSentimentScore: null` | Self-assessment score pill not rendered; only peer score shown (or neither) |
| Peer review has `completedAt: null` (still pending) | Not shown in the per-employee approved list (filtered out by status check) |

---

## Testing Strategy

### Unit Tests

Focus on the specific behavioral changes:

1. **Peer score calculation** — unit test the SQL query or an extracted helper function with known inputs: all sliders, mixed slider/text, zero approved reviews, reviews with mixed statuses.

2. **Client-side grouping** — unit test the `approvedBySubject` derivation: mixed statuses, multiple subjects, empty array.

3. **Score display logic** — unit test the conditional rendering: both scores present, only self, only peer, neither.

4. **Reverse chronological ordering** — unit test that the sort applied to `approvedBySubject[id]` produces the correct order for random date arrays.

5. **`ScorePill` color thresholds** — unit test that the same score value produces the same colors regardless of context.

### Property-Based Tests

The recommended library is **fast-check** (TypeScript-native, already in the ecosystem). Each property test runs a minimum of 100 iterations.

**Property 1: Peer score calculation correctness**
Generate random sets of peer reviews for an employee (varying counts, statuses, slider values 1–5, number of slider questions). Call the reports endpoint (or the extracted calculation helper). Assert `peerScore` equals `round(mean(sliders from approved only), 1)` or `null` when no approved reviews exist.
*Tag: Feature: peer-review-per-employee, Property 1: Peer score calculation correctness*

**Property 2: Peer reviews grouped correctly by subject**
Generate random arrays of `ManagerPeerReview` objects with varying `subjectId` and `status` values. Apply the grouping function. Assert every entry in each group has the correct `subjectId` and `status === 'approved'`.
*Tag: Feature: peer-review-per-employee, Property 2: Peer reviews grouped correctly by subject*

**Property 3: Reports response shape includes all required fields**
Generate random sets of employees (0–20) each with random peer review data. Call `GET /api/manager/reports`. Assert every report object has `name`, `email`, `latestSentimentScore`, and `peerScore` fields present (values may be null).
*Tag: Feature: peer-review-per-employee, Property 3: Reports response shape includes all required fields*

**Property 4: Manager data isolation**
Generate two managers with distinct direct report sets. Call `GET /api/manager/reports` for each. Assert no cross-contamination — each manager sees only their own reports.
*Tag: Feature: peer-review-per-employee, Property 4: Manager data isolation*

**Property 5: Reviewer name and date always rendered**
Generate random approved peer reviews with arbitrary reviewer names and completion dates. Render the peer review entry. Assert the reviewer name and formatted date appear in the output.
*Tag: Feature: peer-review-per-employee, Property 5: Reviewer name and date always rendered*

**Property 6: All responses displayed when expanded**
Generate peer reviews with random arrays of slider and text responses (1–10 questions each). Render and expand. Assert the count of rendered response items equals the total number of questions.
*Tag: Feature: peer-review-per-employee, Property 6: All responses displayed when expanded*

**Property 7: Manager notes displayed if and only if non-null**
Generate approved peer reviews with random `managerNotes` values (null, empty string, arbitrary non-empty strings). Render. Assert notes section is present iff `managerNotes` is a non-empty string.
*Tag: Feature: peer-review-per-employee, Property 7: Manager notes displayed iff non-null*

**Property 8: Peer reviews in reverse chronological order**
Generate random arrays of approved peer reviews with random `completedAt` ISO timestamps. Render the list. Assert the rendered order matches descending sort by `completedAt`.
*Tag: Feature: peer-review-per-employee, Property 8: Peer reviews in reverse chronological order*

**Property 9: Consistent color coding across score types**
Generate random score values in [1.0, 5.0]. Assert `ScorePill` returns the same `bg` and `color` values for any score regardless of the label context (self vs. peer).
*Tag: Feature: peer-review-per-employee, Property 9: Consistent color coding across score types*

**Property 10: Peer review count equals actual approved count**
Generate random employees each with a random number of approved peer reviews. Render the employee card. Assert the displayed count equals the length of the approved reviews array for that employee.
*Tag: Feature: peer-review-per-employee, Property 10: Peer review count equals actual approved count*

### Integration / Smoke Tests

- Full flow: assign peer review → reviewer submits → manager approves → approved review appears under the subject employee card with updated peer score.
- Verify `GET /api/manager/reports` returns `peerScore` without requiring a separate API call.
- Verify the assign form and pending-review approval workflow remain functional after the layout restructure.
- Verify an employee with no approved peer reviews shows the empty-state message and no peer score pill.
