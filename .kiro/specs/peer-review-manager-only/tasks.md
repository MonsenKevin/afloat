# Implementation Plan: Peer Review Manager-Only Delivery

## Overview

Remove the subject from the peer review delivery path. The changes are surgical and confined to six files: the database schema, two backend route files, and two frontend components. No new routes, tables, or services are introduced.

## Tasks

- [x] 1. Migrate database schema and existing data
  - [x] 1.1 Update `backend/src/db/schema.sql` to remove `delivered` from the status comment and reflect the new valid set (`pending_reviewer`, `pending_manager`, `approved`)
    - Change the inline comment on the `status` column from `-- 'pending_reviewer' | 'pending_manager' | 'approved' | 'delivered'` to `-- 'pending_reviewer' | 'pending_manager' | 'approved'`
    - _Requirements: 6.1_

  - [x] 1.2 Write and apply a one-time migration in `backend/src/db/seed.ts` (or a standalone migration script) that updates any existing `peer_reviews` rows with `status = 'delivered'` to `status = 'approved'`
    - SQL: `UPDATE peer_reviews SET status = 'approved' WHERE status = 'delivered';`
    - Preserve all other field values (`responses`, `manager_notes`, `completed_at`, `approved_at`)
    - _Requirements: 6.2, 6.3_

  - [ ]* 1.3 Write property test for migration correctness
    - **Property 9: Migration preserves all field values while updating status**
    - Generate peer review records with `status = 'delivered'` and random `responses`, `manager_notes`, `completed_at`, `approved_at` values; run the migration SQL; assert `status === 'approved'` and all other fields are byte-for-byte identical
    - **Validates: Requirements 6.2, 6.3**

- [x] 2. Block the subject-facing peer review endpoint
  - [x] 2.1 In `backend/src/routes/checkins.ts`, replace the `GET /peer-reviews/received` handler body with an immediate `403` response
    - New body: `return res.status(403).json({ error: 'Peer review feedback is not available to subjects' });`
    - Remove the existing SQLite query, row mapping, and `try/catch` logic from this handler
    - _Requirements: 2.1, 2.3_

  - [ ]* 2.2 Write property test for subject endpoint always returning 403
    - **Property 1: Subject endpoint always returns 403**
    - Generate random authenticated user tokens (varying `id`, `role` — both `New_Employee` and `Manager`, varying `managerId`); for each, call `GET /api/checkins/peer-reviews/received`; assert the response status is always 403
    - **Validates: Requirements 2.1, 2.3**

- [x] 3. Change the approve endpoint to set status `approved` instead of `delivered`
  - [x] 3.1 In `backend/src/routes/manager.ts`, update the `POST /peer-reviews/:id/approve` handler to write `status = 'approved'` instead of `status = 'delivered'`
    - Change the `db.prepare(...)` UPDATE statement: replace `SET status = 'delivered'` with `SET status = 'approved'`
    - _Requirements: 1.1, 1.2_

  - [ ]* 3.2 Write property test for approve transitioning to `approved`, never `delivered`
    - **Property 2: Approve transitions to `approved`, never `delivered`**
    - Generate peer reviews in `pending_manager` state with varying `questions`, `responses`, and `managerNotes`; for each, call the approve endpoint; assert `status === 'approved'` and `status !== 'delivered'` in both the API response and the DB row
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 3.3 Write property test for manager list never containing `delivered` status
    - **Property 3: Manager list never contains `delivered` status**
    - Seed a set of peer reviews with mixed statuses (`pending_reviewer`, `pending_manager`, `approved`); call `GET /api/manager/peer-reviews`; assert no returned review has `status === 'delivered'`
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 3.4 Write property test for approved reviews exposing responses and notes to manager
    - **Property 4: Approved reviews expose responses and notes to manager**
    - Generate peer reviews with varying responses and manager notes; approve them; call `GET /api/manager/peer-reviews`; assert each approved review appears with its `responses` and `managerNotes` intact
    - **Validates: Requirements 1.3, 1.4**

- [x] 4. Checkpoint — Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Verify reviewer submission flow is unaffected
  - [x] 5.1 Confirm `POST /api/checkins/peer-reviews/:id/submit` in `backend/src/routes/checkins.ts` still sets `status = 'pending_manager'` — no code change needed, but add a unit test to lock in the behavior
    - _Requirements: 3.1_

  - [ ]* 5.2 Write property test for reviewer submit always transitioning to `pending_manager`
    - **Property 5: Reviewer submit always transitions to `pending_manager`**
    - Generate peer reviews in `pending_reviewer` state with varying response arrays; submit each; assert `status === 'pending_manager'` in the response and DB
    - **Validates: Requirements 3.1**

- [x] 6. Verify manager rejection flow is unaffected
  - [x] 6.1 Confirm `POST /api/manager/peer-reviews/:id/reject` in `backend/src/routes/manager.ts` still sets `status = 'pending_reviewer'` and records `manager_notes` — no code change needed, but add a unit test to lock in the behavior
    - _Requirements: 4.1, 4.2_

  - [ ]* 6.2 Write property test for reject transitioning to `pending_reviewer` and recording notes
    - **Property 6: Reject transitions to `pending_reviewer` and records notes**
    - Generate peer reviews in `pending_manager` state with varying rejection feedback strings; reject each; assert `status === 'pending_reviewer'` and `manager_notes` equals the provided feedback
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 6.3 Write property test for rejected review reappearing in reviewer's pending list
    - **Property 7: Rejected review reappears in reviewer's pending list**
    - Reject a peer review; call `GET /api/checkins/peer-reviews/pending` as the reviewer; assert the review appears in the returned list
    - **Validates: Requirements 4.3**

- [x] 7. Update `statusBadge` in `ManagerView.tsx`
  - [x] 7.1 In `extension/src/components/Manager/ManagerView.tsx`, update the `statusBadge` function to map `approved` → "Approved" (green badge) and remove the `delivered` entry
    - Replace the `delivered` key with `approved: { label: 'Approved', bg: '#dcfce7', color: '#15803d' }`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 7.2 Write property test for `statusBadge` mapping all valid statuses correctly and never producing "Delivered"
    - **Property 8: `statusBadge` maps all valid statuses correctly and never produces "Delivered"**
    - Generate all valid status strings (`pending_reviewer`, `pending_manager`, `approved`) and arbitrary unknown strings; assert the correct labels are returned for valid statuses and "Delivered" is never returned for any input
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [x] 8. Remove peer feedback section from `Dashboard.tsx`
  - [x] 8.1 In `extension/src/components/Dashboard/Dashboard.tsx`, remove the `ReceivedPeerReview` interface, the `receivedPeerReviews` and `expandedPeerReviews` state variables, the `GET /api/checkins/peer-reviews/received` fetch call, and the entire "Peer Feedback Received" JSX section
    - The component should only render the sentiment trend chart and the past check-ins list
    - _Requirements: 2.2_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The design uses TypeScript throughout — all code examples should be TypeScript
- Property tests use `fast-check` (already in `devDependencies`)
- Backend tests use Jest with `ts-jest` (already configured in `backend/jest.config.ts`)
- The reviewer confirmation message in `CheckInFlow.tsx` already reads "Your feedback has been sent to your manager for review" — no change needed there
