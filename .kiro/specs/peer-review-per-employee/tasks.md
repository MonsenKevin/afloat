# Implementation Plan: Peer Review Per Employee

## Overview

Reorganize the manager view so that approved peer reviews appear under each employee card, add an aggregated peer score to the reports API endpoint, and surface a side-by-side self vs. peer score comparison in the UI. Pending reviews and the assign form remain at the top level for manager action.

## Tasks

- [ ] 1. Extend the backend reports endpoint with peer score calculation
  - Modify `GET /api/manager/reports` in `backend/src/routes/manager.ts` to compute a `peerScore` for each employee using a SQLite subquery over `peer_reviews`
  - Average only slider question responses (questions prefixed with `slider:`) from reviews where `status = 'approved'` and `subject_id = emp.id` and `manager_id = managerId`
  - Round the result to one decimal place; return `null` when no approved reviews exist
  - Add `peerScore: number | null` to the returned report object alongside existing fields
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 5.3, 6.1_

  - [ ]* 1.1 Write property test for peer score calculation correctness
    - **Property 1: Peer score calculation correctness**
    - Generate random sets of peer reviews (varying counts, statuses, slider values 1–5, number of slider questions); call the reports endpoint or an extracted helper; assert `peerScore` equals `round(mean(sliders from approved only), 1)` or `null` when no approved reviews exist
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 4.5, 5.2**

  - [ ]* 1.2 Write property test for reports response shape
    - **Property 3: Reports response shape includes all required fields**
    - Generate random sets of employees (0–20) each with random peer review data; call `GET /api/manager/reports`; assert every report object has `name`, `email`, `latestSentimentScore`, and `peerScore` fields present (values may be null)
    - **Validates: Requirements 5.1, 5.3**

  - [ ]* 1.3 Write property test for manager data isolation
    - **Property 4: Manager data isolation**
    - Generate two managers with distinct direct report sets; call `GET /api/manager/reports` for each; assert no cross-contamination — each manager sees only their own reports
    - **Validates: Requirements 5.4**

- [x] 2. Update frontend `Report` interface and client-side grouping logic
  - Add `peerScore: number | null` to the `Report` interface in `extension/src/components/Manager/ManagerView.tsx`
  - Extend `ExpandedSection` type to include `'peerreviews'`
  - Add derived variables `approvedBySubject` and `pendingReviews` computed from the `peerReviews` state array on each render (no memoization needed)
  - `approvedBySubject`: `Record<string, ManagerPeerReview[]>` — only reviews with `status === 'approved'`, keyed by `subjectId`
  - `pendingReviews`: `ManagerPeerReview[]` — all reviews with status other than `'approved'`
  - Sort each `approvedBySubject[id]` array in descending order of `completedAt` (newest first)
  - _Requirements: 1.1, 1.2, 4.4, 7.5_

  - [ ]* 2.1 Write property test for client-side grouping correctness
    - **Property 2: Peer reviews grouped correctly by subject**
    - Generate random arrays of `ManagerPeerReview` objects with varying `subjectId` and `status` values; apply the grouping function; assert every entry in each group has the correct `subjectId` and `status === 'approved'`, and no non-approved review appears in any group
    - **Validates: Requirements 1.2, 4.4**

  - [ ]* 2.2 Write property test for reverse chronological ordering
    - **Property 8: Peer reviews in reverse chronological order**
    - Generate random arrays of approved peer reviews with random `completedAt` ISO timestamps; apply the sort; assert the resulting order matches descending sort by `completedAt`
    - **Validates: Requirements 7.5**

- [x] 3. Update employee card score display (self vs. peer side-by-side)
  - Replace the single `ScorePill` in the employee card header with a two-score layout: a "self" labelled pill for `latestSentimentScore` and a "peer" labelled pill for `peerScore`
  - Each pill is only rendered when its value is non-null; if both are null, neither is shown
  - Both pills use the same `ScorePill` component and the same color thresholds (≥4 green, ≥3 yellow, <3 red)
  - Add small `"self"` / `"peer"` labels above each pill as shown in the design
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.1 Write property test for consistent color coding
    - **Property 9: Consistent color coding across score types**
    - Generate random score values in [1.0, 5.0]; assert `ScorePill` returns the same `bg` and `color` values for any score regardless of the label context (self vs. peer)
    - **Validates: Requirements 3.5**

- [x] 4. Add "Peer Reviews" toggle button and approved reviews panel to each employee card
  - Add a "👥 Peer Reviews" button alongside the existing "📈 Trend" and "📋 Check-ins" buttons in each employee card's action row
  - When toggled, expand a panel below the action row listing all approved peer reviews for that employee from `approvedBySubject[report.id]`
  - Each peer review entry shows: reviewer name, formatted `completedAt` date, and an expand/collapse toggle for full responses
  - When expanded, render all questions and responses (slider bars for `slider:` questions, text for `text:` questions) — same rendering pattern as the existing check-in detail view
  - Display `managerNotes` below the responses if `managerNotes` is a non-null, non-empty string
  - When no approved reviews exist for an employee, show an empty-state message: "No peer feedback yet."
  - Display the count of approved peer reviews in the toggle button label (e.g., "👥 Peer Reviews (2)")
  - _Requirements: 1.3, 1.4, 1.5, 7.1, 7.2, 7.3, 7.4_

  - [ ]* 4.1 Write property test for reviewer name and date always rendered
    - **Property 5: Reviewer name and date always rendered**
    - Generate random approved peer reviews with arbitrary reviewer names and completion dates; render the peer review entry; assert the reviewer name and formatted date appear in the output
    - **Validates: Requirements 7.1**

  - [ ]* 4.2 Write property test for all responses displayed when expanded
    - **Property 6: All responses displayed when expanded**
    - Generate peer reviews with random arrays of slider and text responses (1–10 questions each); render and expand; assert the count of rendered response items equals the total number of questions
    - **Validates: Requirements 7.3**

  - [ ]* 4.3 Write property test for manager notes conditional display
    - **Property 7: Manager notes displayed if and only if non-null**
    - Generate approved peer reviews with random `managerNotes` values (null, empty string, arbitrary non-empty strings); render; assert notes section is present iff `managerNotes` is a non-empty string
    - **Validates: Requirements 7.4**

  - [ ]* 4.4 Write property test for peer review count display
    - **Property 10: Peer review count equals actual approved count**
    - Generate random employees each with a random number of approved peer reviews; render the employee card; assert the displayed count equals the length of the `approvedBySubject[employee.id]` array
    - **Validates: Requirements 1.4**

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Restructure the top-level peer reviews section
  - Remove the flat "Peer Reviews" list that currently renders all reviews together at the bottom of the page
  - Replace it with two sub-sections:
    1. The `+ Assign Peer Review` button and assign form (unchanged behavior)
    2. A "Pending Reviews" sub-section listing only reviews in `pendingReviews` (status `pending_reviewer` or `pending_manager`), preserving the existing approve/reject workflow
  - The pending reviews section should be hidden (or show "No pending reviews") when `pendingReviews` is empty
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 7. Wire peer score into the UI after approve action
  - After `handleApprovePeerReview` succeeds, re-fetch `GET /api/manager/reports` to get the updated `peerScore` for the subject employee, or optimistically update the `reports` state by recalculating the peer score client-side from the newly approved review
  - Ensure the peer score pill in the employee card updates immediately after approval without a full page reload
  - _Requirements: 4.4, 4.5_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use **fast-check** (already in `backend/package.json` devDependencies)
- Backend tests live in `backend/src/` with the `.test.ts` suffix; run with `npm test` in the `backend/` directory
- The design uses no new tables, routes, or services — all changes are additive on the backend and structural on the frontend
- The `approvedBySubject` grouping is computed on every render (no memoization needed at team sizes up to 20)
- Slider responses are stored as strings in JSON and must be cast to numbers before averaging
