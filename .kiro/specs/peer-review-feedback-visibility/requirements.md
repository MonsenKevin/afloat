# Requirements Document

## Introduction

Currently, peer review feedback in the Afloat extension is gated behind the self check-in flow in two ways:

1. **Pending peer reviews to complete** — when a user has both a pending self check-in and pending peer reviews to fill out, the self check-in flow takes over the entire Chat tab. The user cannot access or dismiss peer review prompts until they finish their own check-in.
2. **Received peer feedback in the Dashboard** — the Dashboard renders an empty state ("No check-ins yet") when the user has no completed check-ins, which hides the "Peer Feedback Received" section entirely even if approved peer feedback exists for that user.

This feature removes both gates so that peer review feedback is always accessible regardless of check-in status.

## Glossary

- **CheckInFlow**: The React component (`CheckInFlow.tsx`) that renders the self check-in questionnaire and peer review prompts on the Chat tab.
- **Dashboard**: The React component (`Dashboard.tsx`) that displays check-in history, sentiment trend, and received peer feedback.
- **MainShell**: The React component (`MainShell.tsx`) that controls tab routing and decides which component to render in the content area.
- **Pending Self Check-in**: A check-in record with `status = 'pending'` and `due_at <= now()` assigned to the current user, requiring the user to answer questions about their own wellbeing and culture values.
- **Pending Peer Review**: A peer review record with `status = 'pending_reviewer'` assigned to the current user as reviewer, requiring the user to rate and comment on a colleague.
- **Received Peer Feedback**: A peer review record with `status = 'delivered'` where the current user is the subject, representing approved feedback visible to the user.
- **PeerReviewFlow**: The sub-component within `CheckInFlow.tsx` that renders the two-page peer review questionnaire for a specific colleague.
- **RoutingCard**: The component shown after a self check-in is submitted, displaying the sentiment result and support resources.

## Requirements

### Requirement 1: Peer Review Prompts Are Accessible Independently of Self Check-in

**User Story:** As an employee, I want to see and complete pending peer reviews even when I have a pending self check-in, so that I can provide timely feedback for colleagues without being forced to complete my own check-in first.

#### Acceptance Criteria

1. WHEN the Chat tab is active and the user has both a Pending Self Check-in and at least one Pending Peer Review, THE MainShell SHALL render both the self check-in content and a peer review access mechanism simultaneously, rather than hiding peer reviews behind the self check-in flow.
2. WHEN the user initiates a Pending Peer Review from the Chat tab, THE CheckInFlow SHALL render the PeerReviewFlow for that review without requiring the Pending Self Check-in to be completed first.
3. WHEN the user completes or dismisses a PeerReviewFlow while a Pending Self Check-in exists, THE CheckInFlow SHALL return the user to the self check-in flow.
4. WHEN the user has Pending Peer Reviews and no Pending Self Check-in, THE CheckInFlow SHALL display the peer review prompts as it currently does.
5. WHEN the user has no Pending Self Check-in and no Pending Peer Reviews, THE CheckInFlow SHALL render nothing (return null), preserving existing behavior.

### Requirement 2: Received Peer Feedback Is Visible in the Dashboard Without Prior Check-ins

**User Story:** As an employee, I want to see peer feedback that has been approved and delivered to me even if I have never completed a self check-in, so that I can access all feedback about my performance regardless of my check-in history.

#### Acceptance Criteria

1. WHEN the Dashboard loads and the user has zero completed self check-ins but has at least one Received Peer Feedback entry, THE Dashboard SHALL display the "Peer Feedback Received" section.
2. WHEN the Dashboard loads and the user has zero completed self check-ins and zero Received Peer Feedback entries, THE Dashboard SHALL display the existing empty state ("No check-ins yet").
3. WHEN the Dashboard loads and the user has at least one completed self check-in, THE Dashboard SHALL display the sentiment trend chart and check-in history regardless of whether Received Peer Feedback exists, preserving existing behavior.
4. THE Dashboard SHALL fetch Received Peer Feedback from `GET /api/checkins/peer-reviews/received` independently of the check-in history fetch, so that a failure in one request does not prevent the other from rendering.

### Requirement 3: Peer Review Feedback Visibility State Is Consistent Across Sessions

**User Story:** As an employee, I want the peer review section to reflect the latest data each time I open the extension, so that I always see up-to-date feedback without stale or missing entries.

#### Acceptance Criteria

1. WHEN the user opens the extension and navigates to the Dashboard tab, THE Dashboard SHALL fetch Received Peer Feedback on mount, independent of any cached check-in history.
2. WHEN the Chat tab becomes active, THE MainShell SHALL re-fetch Pending Peer Reviews so that newly assigned reviews appear without requiring an extension restart, preserving existing behavior.
3. IF the `GET /api/checkins/peer-reviews/received` request fails, THEN THE Dashboard SHALL render the check-in history section (if data is available) without displaying an error state for the peer feedback section, silently ignoring the failure.

### Requirement 4: Self Check-in Urgency Indicator Remains Visible When Peer Reviews Are Accessible

**User Story:** As an employee, I want to be reminded that my self check-in is still due even while I am viewing or completing peer reviews, so that I do not forget to submit my own check-in.

#### Acceptance Criteria

1. WHEN the user is viewing Pending Peer Review prompts on the Chat tab and a Pending Self Check-in exists, THE CheckInFlow SHALL display a visible indicator (such as a banner or badge) communicating that a self check-in is also due.
2. WHEN the user completes a PeerReviewFlow and a Pending Self Check-in still exists, THE CheckInFlow SHALL return focus to the self check-in flow automatically.
3. WHEN the user dismisses all Pending Peer Review prompts and a Pending Self Check-in exists, THE CheckInFlow SHALL display the self check-in flow.
