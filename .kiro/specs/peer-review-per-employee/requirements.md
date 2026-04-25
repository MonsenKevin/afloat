# Requirements Document

## Introduction

This feature reorganizes the manager view to display peer reviews underneath each employee (the subject) rather than in a separate section. It also introduces an aggregated peer score calculated from all approved peer reviews for each employee, enabling managers to compare self-assessment scores (from check-ins) with peer-assessment scores side-by-side.

## Glossary

- **Manager_View**: The UI component that displays direct reports and their performance data to managers
- **Peer_Review**: A structured feedback form completed by one employee (reviewer) about another employee (subject)
- **Subject**: The employee being reviewed in a peer review
- **Reviewer**: The employee providing feedback in a peer review
- **Approved_Peer_Review**: A peer review that has been approved by the manager and is ready for delivery
- **Peer_Score**: An aggregated numerical score calculated from all approved peer reviews for a specific employee
- **Self_Assessment_Score**: The sentiment score from an employee's check-in responses
- **Backend_API**: The server-side API that provides peer review and employee data
- **UI_Component**: The React component that renders the manager view interface

## Requirements

### Requirement 1: Display Peer Reviews Under Employee

**User Story:** As a manager, I want to see peer reviews grouped under each employee they're about, so that I can view all feedback for a person in one place.

#### Acceptance Criteria

1. WHEN THE Manager_View renders, THE UI_Component SHALL fetch peer reviews for all direct reports
2. FOR ALL approved peer reviews, THE UI_Component SHALL group them by subject_id
3. WHEN displaying an employee card, THE UI_Component SHALL show peer reviews for that employee underneath their check-in data
4. THE UI_Component SHALL display peer review count for each employee
5. WHEN no approved peer reviews exist for an employee, THE UI_Component SHALL display a message indicating no peer feedback is available

### Requirement 2: Calculate Aggregated Peer Score

**User Story:** As a manager, I want to see an aggregated peer score for each employee, so that I can quickly assess how peers rate their performance.

#### Acceptance Criteria

1. WHEN approved peer reviews exist for an employee, THE Backend_API SHALL calculate an aggregated peer score from slider question responses
2. THE Backend_API SHALL include only responses from approved peer reviews in the calculation
3. THE Backend_API SHALL compute the peer score as the arithmetic mean of all slider question responses across all approved peer reviews
4. WHEN an employee has no approved peer reviews, THE Backend_API SHALL return null for the peer score
5. THE Backend_API SHALL return peer scores with one decimal place precision

### Requirement 3: Display Self-Assessment and Peer Score Comparison

**User Story:** As a manager, I want to see both self-assessment and peer scores side-by-side, so that I can identify alignment or gaps in perception.

#### Acceptance Criteria

1. WHEN an employee has both a self-assessment score and a peer score, THE UI_Component SHALL display both scores adjacent to each other
2. THE UI_Component SHALL visually distinguish self-assessment scores from peer scores using labels or icons
3. WHEN only a self-assessment score exists, THE UI_Component SHALL display only the self-assessment score
4. WHEN only a peer score exists, THE UI_Component SHALL display only the peer score
5. THE UI_Component SHALL use consistent color coding for score ranges across both score types

### Requirement 4: Maintain Peer Review Management Functionality

**User Story:** As a manager, I want to continue managing peer review assignments and approvals, so that I can control the feedback process.

#### Acceptance Criteria

1. THE UI_Component SHALL preserve the ability to assign new peer reviews
2. THE UI_Component SHALL preserve the ability to approve pending peer reviews
3. THE UI_Component SHALL preserve the ability to reject and send back peer reviews to reviewers
4. WHEN a peer review is approved, THE UI_Component SHALL immediately update the display to show it under the subject employee
5. WHEN a peer review is approved, THE Backend_API SHALL recalculate the peer score for the subject employee

### Requirement 5: Backend API Endpoint for Peer Scores

**User Story:** As a developer, I want a backend endpoint that provides peer scores per employee, so that the frontend can display aggregated peer feedback.

#### Acceptance Criteria

1. THE Backend_API SHALL provide peer scores as part of the direct reports endpoint response
2. WHEN calculating peer scores, THE Backend_API SHALL query only approved peer reviews
3. THE Backend_API SHALL return peer scores alongside existing employee data (name, email, self-assessment score)
4. WHEN a manager requests reports, THE Backend_API SHALL verify the manager has permission to view each employee's data
5. THE Backend_API SHALL return an empty array when a manager has no direct reports

### Requirement 6: Performance and Data Loading

**User Story:** As a manager, I want the view to load quickly, so that I can efficiently review my team's performance.

#### Acceptance Criteria

1. THE Backend_API SHALL calculate peer scores during the reports query without requiring separate API calls
2. THE UI_Component SHALL fetch all necessary data (reports, peer reviews, peer scores) in parallel where possible
3. WHEN peer review data is loading, THE UI_Component SHALL display a loading indicator
4. THE Backend_API SHALL complete the reports endpoint request within 2 seconds for teams up to 20 employees
5. THE UI_Component SHALL render the employee list within 500ms after receiving data from the Backend_API

### Requirement 7: Peer Review Detail Display

**User Story:** As a manager, I want to view individual peer review responses under each employee, so that I can understand the detailed feedback.

#### Acceptance Criteria

1. WHEN displaying peer reviews under an employee, THE UI_Component SHALL show reviewer name and completion date
2. THE UI_Component SHALL provide an expandable interface to view full peer review responses
3. WHEN a peer review is expanded, THE UI_Component SHALL display all slider and text responses
4. THE UI_Component SHALL display manager notes if they were added during approval
5. THE UI_Component SHALL display peer reviews in reverse chronological order (newest first)
