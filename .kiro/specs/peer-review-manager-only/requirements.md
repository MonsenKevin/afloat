# Requirements Document

## Introduction

This feature changes the peer review feedback delivery model so that feedback collected from a reviewer is visible only to the manager — never to the subject (the person being reviewed). Currently, once a manager approves a peer review, its status transitions to `delivered` and the subject can retrieve the full feedback via their dashboard. The new behavior removes the subject from the delivery path entirely: the manager assigns the review, the reviewer fills it out, and the manager receives and retains the feedback for their own use. The subject's dashboard no longer shows a "Peer Feedback Received" section, and no API endpoint exposes peer review data to the subject.

## Glossary

- **Manager**: A user with role `Manager` who assigns peer reviews and receives completed feedback.
- **Reviewer**: A direct report of the Manager who is assigned to evaluate a peer.
- **Subject**: The direct report of the Manager who is being evaluated. Under this feature, the Subject has no visibility into peer review feedback.
- **Peer_Review**: A record in the `peer_reviews` table tracking the assignment, responses, and status of a single peer evaluation.
- **Peer_Review_System**: The combined backend routes, database layer, and frontend components that manage the peer review lifecycle.
- **Dashboard**: The employee-facing `Dashboard` component that displays personal check-in history and previously showed received peer feedback.
- **Manager_View**: The manager-facing `ManagerView` component where the Manager assigns reviews and reads submitted feedback.

## Requirements

### Requirement 1: Manager-Only Feedback Delivery

**User Story:** As a Manager, I want peer review feedback to be delivered only to me, so that I can use it as a private management tool without the subject seeing it.

#### Acceptance Criteria

1. WHEN a Manager approves a Peer_Review, THE Peer_Review_System SHALL transition the Peer_Review status to `approved` and SHALL NOT make the feedback accessible to the Subject.
2. THE Peer_Review_System SHALL NOT expose a status value of `delivered` in any API response or database record after this feature is implemented.
3. WHEN a Manager retrieves the list of Peer_Reviews via `GET /api/manager/peer-reviews`, THE Peer_Review_System SHALL return all Peer_Reviews with status `pending_reviewer`, `pending_manager`, or `approved`.
4. WHEN a Manager views an `approved` Peer_Review in the Manager_View, THE Peer_Review_System SHALL display the reviewer's responses and any manager notes.

### Requirement 2: Subject Cannot Access Peer Feedback

**User Story:** As a Subject, I want my dashboard to reflect only my own check-in data, so that I am not shown peer feedback that was intended for my manager.

#### Acceptance Criteria

1. WHEN the Subject calls `GET /api/checkins/peer-reviews/received`, THE Peer_Review_System SHALL return an empty list or a 403 response, regardless of the Peer_Review status.
2. THE Dashboard SHALL NOT render a "Peer Feedback Received" section or any UI element that displays peer review responses to the Subject.
3. IF the Subject attempts to access peer review data through any API endpoint, THEN THE Peer_Review_System SHALL return an error response with HTTP status 403.

### Requirement 3: Reviewer Submission Flow Unchanged

**User Story:** As a Reviewer, I want the process of filling out and submitting a peer review to remain the same, so that I am not disrupted by backend delivery changes.

#### Acceptance Criteria

1. WHEN a Reviewer submits responses via `POST /api/checkins/peer-reviews/:id/submit`, THE Peer_Review_System SHALL transition the Peer_Review status from `pending_reviewer` to `pending_manager`.
2. WHEN a Reviewer submits a Peer_Review, THE Peer_Review_System SHALL display a confirmation message stating that the feedback has been sent to the Manager for review.
3. THE Peer_Review_System SHALL NOT display any message to the Reviewer indicating that feedback will be shared with the Subject.

### Requirement 4: Manager Rejection Flow Unchanged

**User Story:** As a Manager, I want to be able to send a peer review back to the reviewer for revision, so that I can ensure feedback quality before it is recorded.

#### Acceptance Criteria

1. WHEN a Manager rejects a Peer_Review via `POST /api/manager/peer-reviews/:id/reject`, THE Peer_Review_System SHALL transition the Peer_Review status back to `pending_reviewer`.
2. WHEN a Manager rejects a Peer_Review, THE Peer_Review_System SHALL record the Manager's rejection reason in the `manager_notes` field.
3. WHEN a Peer_Review is returned to `pending_reviewer` status, THE Peer_Review_System SHALL make it available again to the Reviewer via `GET /api/checkins/peer-reviews/pending`.

### Requirement 5: Status Badge Consistency in Manager View

**User Story:** As a Manager, I want the status labels in my view to accurately reflect the new lifecycle, so that I am not confused by a "Delivered" label that no longer applies.

#### Acceptance Criteria

1. THE Manager_View SHALL display the status `approved` as "Approved" (or equivalent label) and SHALL NOT display the label "Delivered" for any Peer_Review.
2. WHEN a Peer_Review has status `pending_reviewer`, THE Manager_View SHALL display the label "Awaiting Review".
3. WHEN a Peer_Review has status `pending_manager`, THE Manager_View SHALL display the label "Needs Approval".
4. WHEN a Peer_Review has status `approved`, THE Manager_View SHALL display the label "Approved".

### Requirement 6: Database Schema Consistency

**User Story:** As a developer, I want the database schema to reflect the new status values, so that the data model is accurate and no legacy `delivered` records cause confusion.

#### Acceptance Criteria

1. THE Peer_Review_System SHALL update the `peer_reviews` table CHECK constraint to allow status values `pending_reviewer`, `pending_manager`, `approved`, and SHALL NOT include `delivered` as a valid status.
2. IF any existing Peer_Review records have status `delivered`, THEN THE Peer_Review_System SHALL migrate those records to status `approved` during schema update.
3. THE Peer_Review_System SHALL preserve all existing `responses`, `manager_notes`, `completed_at`, and `approved_at` field values during migration.
