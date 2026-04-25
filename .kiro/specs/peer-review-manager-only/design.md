# Design Document: Peer Review Manager-Only Delivery

## Overview

This feature changes the peer review lifecycle so that feedback collected from a reviewer is delivered exclusively to the manager. The subject (the person being reviewed) loses all visibility into peer review data — no API endpoint returns it to them, and their dashboard no longer renders a "Peer Feedback Received" section.

The change is surgical: the reviewer submission flow is untouched, the manager approval/rejection flow is untouched, and the only structural change is removing the `delivered` status and blocking the subject-facing read path.

### Current Flow (to be changed)

```
pending_reviewer → pending_manager → approved → delivered
                                                    ↓
                                             subject can read
```

### New Flow

```
pending_reviewer → pending_manager → approved
                                        ↓
                                  manager reads only
```

The `delivered` status is eliminated. Once a manager approves a review it stays `approved` and is only accessible through manager-scoped endpoints.

---

## Architecture

The system is a Chrome extension (React + Zustand) backed by an Express/SQLite API. The peer review feature spans:

- **Database layer** (`backend/src/db/schema.sql`, `afloat.db`) — `peer_reviews` table with a `status` CHECK constraint
- **Backend routes** (`backend/src/routes/checkins.ts`, `backend/src/routes/manager.ts`) — reviewer-facing and manager-facing endpoints
- **Frontend store** (`extension/src/store/checkinStore.ts`) — fetches pending reviews and submits responses
- **Frontend components**:
  - `extension/src/components/CheckIn/CheckInFlow.tsx` — reviewer submission UI and confirmation message
  - `extension/src/components/Dashboard/Dashboard.tsx` — subject's dashboard (currently shows received peer feedback)
  - `extension/src/components/Manager/ManagerView.tsx` — manager's view with status badges

The changes are confined to these files. No new services, no new routes, no new tables.

---

## Components and Interfaces

### Backend Changes

#### 1. `GET /api/checkins/peer-reviews/received` (checkins.ts)

**Current behavior**: Returns `peer_reviews` rows where `subject_id = req.user.id AND status = 'delivered'`.

**New behavior**: Returns HTTP 403 for all callers, regardless of role or review status. The endpoint is effectively blocked.

```typescript
router.get('/peer-reviews/received', (req, res) => {
  return res.status(403).json({ error: 'Peer review feedback is not available to subjects' });
});
```

#### 2. `POST /api/manager/peer-reviews/:id/approve` (manager.ts)

**Current behavior**: Sets `status = 'delivered'`.

**New behavior**: Sets `status = 'approved'`. No delivery to subject occurs.

```typescript
db.prepare(`
  UPDATE peer_reviews
  SET status = 'approved', approved_at = ?, manager_notes = ?
  WHERE id = ?
`).run(now, managerNotes || null, req.params.id);
```

#### 3. `GET /api/manager/peer-reviews` (manager.ts)

**Current behavior**: Returns reviews with statuses `pending_reviewer`, `pending_manager`, `delivered`.

**New behavior**: Returns reviews with statuses `pending_reviewer`, `pending_manager`, `approved`. No query change needed — the status values in the DB will simply be different.

#### 4. Database schema (schema.sql + migration)

**Current CHECK constraint**:
```sql
status TEXT NOT NULL DEFAULT 'pending_reviewer',
-- 'pending_reviewer' | 'pending_manager' | 'approved' | 'delivered'
```

**New CHECK constraint** (SQLite does not enforce CHECK on existing rows, but the comment and any future migration script should reflect the change):
```sql
status TEXT NOT NULL DEFAULT 'pending_reviewer',
-- 'pending_reviewer' | 'pending_manager' | 'approved'
```

A one-time migration updates any existing `delivered` rows to `approved`.

### Frontend Changes

#### 5. `Dashboard.tsx`

**Current behavior**: Fetches `GET /api/checkins/peer-reviews/received` and renders a "Peer Feedback Received" section if results are returned.

**New behavior**: The fetch call and the entire "Peer Feedback Received" section are removed. The component only renders check-in history and the sentiment trend chart.

#### 6. `CheckInFlow.tsx` — reviewer confirmation message

**Current behavior**: After submitting, shows "Your feedback has been sent to your manager for review." (already correct per requirements).

**New behavior**: No change needed — the message already does not mention the subject. Verified in the existing `PeerReviewFlow` submitted state:
```tsx
<p>Your feedback has been sent to your manager for review.</p>
```

#### 7. `ManagerView.tsx` — `statusBadge` function

**Current behavior**: Maps `delivered` → "Delivered". Does not map `approved`.

**New behavior**: Maps `approved` → "Approved" (green badge). Removes the `delivered` entry.

```typescript
function statusBadge(status: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pending_reviewer: { label: 'Awaiting Review',  bg: '#fff7ed', color: '#ea580c' },
    pending_manager:  { label: 'Needs Approval',   bg: '#e0f2fe', color: '#0369a1' },
    approved:         { label: 'Approved',          bg: '#dcfce7', color: '#15803d' },
  };
  const s = map[status] || { label: status, bg: '#f3f4f6', color: '#374151' };
  ...
}
```

---

## Data Models

### `peer_reviews` table — status lifecycle

| Status | Meaning | Who can read |
|---|---|---|
| `pending_reviewer` | Assigned, awaiting reviewer response | Reviewer (via `/api/checkins/peer-reviews/pending`) |
| `pending_manager` | Reviewer submitted, awaiting manager action | Manager (via `/api/manager/peer-reviews`) |
| `approved` | Manager approved, feedback retained | Manager only |

The `delivered` status is removed from the valid set. The schema comment is updated to reflect this.

### Migration

For any existing `peer_reviews` rows with `status = 'delivered'`:

```sql
UPDATE peer_reviews SET status = 'approved' WHERE status = 'delivered';
```

This is a non-destructive update. All `responses`, `manager_notes`, `completed_at`, and `approved_at` values are preserved.

### `ReceivedPeerReview` interface (Dashboard.tsx)

The `ReceivedPeerReview` interface and its associated state (`receivedPeerReviews`, `expandedPeerReviews`) are removed from `Dashboard.tsx` entirely since the component no longer fetches or renders this data.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Subject endpoint always returns 403

*For any* authenticated user (regardless of role, ID, or the current state of peer reviews in the system), calling `GET /api/checkins/peer-reviews/received` SHALL return HTTP 403.

**Validates: Requirements 2.1, 2.3**

### Property 2: Approve transitions to `approved`, never `delivered`

*For any* peer review in `pending_manager` status (with any combination of questions, responses, and manager notes), after a manager calls `POST /api/manager/peer-reviews/:id/approve`, the resulting status in both the API response and the database SHALL be `approved` and SHALL NOT be `delivered`.

**Validates: Requirements 1.1, 1.2**

### Property 3: Manager list never contains `delivered` status

*For any* manager and any set of peer reviews in the system (with any mix of valid statuses), the response from `GET /api/manager/peer-reviews` SHALL NOT contain any peer review with `status === 'delivered'`.

**Validates: Requirements 1.2, 1.3**

### Property 4: Approved reviews expose responses and notes to manager

*For any* peer review with status `approved` (with any non-null responses and any manager notes value), the manager who owns it SHALL be able to retrieve it via `GET /api/manager/peer-reviews` and the returned record SHALL include the reviewer's responses and the manager notes field.

**Validates: Requirements 1.3, 1.4**

### Property 5: Reviewer submit always transitions to `pending_manager`

*For any* peer review in `pending_reviewer` status and any valid responses array, after the reviewer calls `POST /api/checkins/peer-reviews/:id/submit`, the resulting status SHALL be `pending_manager`.

**Validates: Requirements 3.1**

### Property 6: Reject transitions to `pending_reviewer` and records notes

*For any* peer review in `pending_manager` status and any non-empty rejection feedback string, after a manager calls `POST /api/manager/peer-reviews/:id/reject`, the resulting status SHALL be `pending_reviewer` and the `manager_notes` field SHALL equal the provided feedback string.

**Validates: Requirements 4.1, 4.2**

### Property 7: Rejected review reappears in reviewer's pending list

*For any* peer review that a manager rejects (transitioning it back to `pending_reviewer`), the reviewer SHALL be able to retrieve it via `GET /api/checkins/peer-reviews/pending`.

**Validates: Requirements 4.3**

### Property 8: `statusBadge` maps all valid statuses correctly and never produces "Delivered"

*For any* valid peer review status value (`pending_reviewer`, `pending_manager`, `approved`), the `statusBadge` function SHALL return the correct label ("Awaiting Review", "Needs Approval", "Approved" respectively), and for no input SHALL it return the label "Delivered".

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 9: Migration preserves all field values while updating status

*For any* peer review record with `status = 'delivered'` and any combination of `responses`, `manager_notes`, `completed_at`, and `approved_at` values, after the migration script runs, the record SHALL have `status = 'approved'` and all other field values SHALL be byte-for-byte identical to their pre-migration values.

**Validates: Requirements 6.2, 6.3**

---

## Error Handling

### Backend

| Scenario | Response |
|---|---|
| Subject calls `GET /api/checkins/peer-reviews/received` | `403 { error: "Peer review feedback is not available to subjects" }` |
| Manager approves a review not in `pending_manager` state | `400 { error: "Peer review is not pending manager approval" }` (unchanged) |
| Manager approves a review they don't own | `404 { error: "Peer review not found" }` (unchanged) |
| Any unauthenticated request | `401` (unchanged, handled by `requireAuth` middleware) |

### Frontend

- `Dashboard.tsx`: The `GET /api/checkins/peer-reviews/received` call is removed entirely, so the 403 is never triggered from the UI. The `try/catch` block that previously silently ignored errors is removed along with the call.
- `ManagerView.tsx`: No new error paths. The `statusBadge` fallback (`label: status`) handles any unexpected status values gracefully.

---

## Testing Strategy

### Unit Tests

Focus on the specific behavioral changes:

1. **`GET /api/checkins/peer-reviews/received` returns 403** — test with a `New_Employee` token, a `Manager` token, and an unauthenticated request. All should return 403 (unauthenticated returns 401 from middleware before reaching the handler).

2. **`POST /api/manager/peer-reviews/:id/approve` sets status to `approved`** — create a review in `pending_manager` state, approve it, assert the returned status is `approved` and no `delivered` value appears anywhere in the response.

3. **`statusBadge` in `ManagerView`** — unit test the mapping function: `approved` → "Approved", `pending_reviewer` → "Awaiting Review", `pending_manager` → "Needs Approval", `delivered` → falls through to the default (not "Delivered").

4. **Migration script** — seed a DB with a `delivered` row, run the migration, assert the row now has `approved` status and all other fields are unchanged.

### Property-Based Tests

The feature involves access control logic and status transitions that benefit from property-based testing. The recommended library is **fast-check** (already in the TypeScript ecosystem).

Each property test should run a minimum of 100 iterations.

**Property 1: Subject endpoint always returns 403**
Generate random user tokens (varying `id`, `role`, `managerId`). For each, call `GET /api/checkins/peer-reviews/received`. Assert the response status is always 403.
*Tag: Feature: peer-review-manager-only, Property 1: Subject endpoint always returns 403*

**Property 2: Approve transitions to `approved`, never `delivered`**
Generate peer reviews in `pending_manager` state with varying `questions`, `responses`, and `managerNotes`. For each, call the approve endpoint. Assert `status === 'approved'` and `status !== 'delivered'` in the response and in the DB.
*Tag: Feature: peer-review-manager-only, Property 2: Approve transitions to approved, never delivered*

**Property 3: Manager list never contains `delivered` status**
Generate a set of peer reviews with mixed statuses (`pending_reviewer`, `pending_manager`, `approved`). Call `GET /api/manager/peer-reviews`. Assert no returned review has `status === 'delivered'`.
*Tag: Feature: peer-review-manager-only, Property 3: Manager list never contains delivered status*

**Property 4: Approved reviews expose responses and notes to manager**
Generate peer reviews with varying responses and manager notes. Approve them. Call `GET /api/manager/peer-reviews`. Assert each approved review appears with its `responses` and `managerNotes` intact.
*Tag: Feature: peer-review-manager-only, Property 4: Approved reviews expose responses and notes to manager*

**Property 5: Reviewer submit always transitions to `pending_manager`**
Generate peer reviews in `pending_reviewer` state with varying response arrays. Submit each. Assert `status === 'pending_manager'` in the response and DB.
*Tag: Feature: peer-review-manager-only, Property 5: Reviewer submit always transitions to pending_manager*

**Property 6: Reject transitions to `pending_reviewer` and records notes**
Generate peer reviews in `pending_manager` state with varying rejection feedback strings. Reject each. Assert `status === 'pending_reviewer'` and `manager_notes` equals the provided feedback.
*Tag: Feature: peer-review-manager-only, Property 6: Reject transitions to pending_reviewer and records notes*

**Property 7: Rejected review reappears in reviewer's pending list**
Reject a peer review. Call `GET /api/checkins/peer-reviews/pending` as the reviewer. Assert the review appears in the returned list.
*Tag: Feature: peer-review-manager-only, Property 7: Rejected review reappears in reviewer pending list*

**Property 8: `statusBadge` maps all valid statuses correctly and never produces "Delivered"**
Generate all valid status strings (`pending_reviewer`, `pending_manager`, `approved`) and arbitrary unknown strings. Assert the correct labels are returned for valid statuses and "Delivered" is never returned for any input.
*Tag: Feature: peer-review-manager-only, Property 8: statusBadge maps all valid statuses correctly and never produces Delivered*

**Property 9: Migration preserves all field values while updating status**
Generate peer review records with `status = 'delivered'` and random `responses`, `manager_notes`, `completed_at`, `approved_at` values. Run the migration SQL. Assert `status === 'approved'` and all other fields are unchanged.
*Tag: Feature: peer-review-manager-only, Property 9: Migration preserves all field values while updating status*

### Integration / Smoke Tests

- Verify the full reviewer → manager approval flow end-to-end: assign → reviewer submits → manager approves → subject dashboard shows no peer feedback section.
- Verify the `Dashboard` component renders without errors when the peer reviews fetch is absent.
- Verify the DB schema rejects an INSERT with `status = 'delivered'` after the constraint update.
