# Requirements Document

## Introduction

This feature enhances the manager view with a detailed team dashboard and employee search/filter capabilities. Currently, managers see a flat list of direct reports with no way to quickly find a specific employee or filter by health indicators. This feature adds a summary dashboard at the top (team averages, at-risk count, peer review stats) and a search/filter bar so managers can quickly surface the employees they need to focus on.

## Glossary

- **Manager_View**: The React component that displays direct reports and their performance data to managers.
- **Team_Dashboard**: A summary panel at the top of the Manager_View showing aggregated team metrics.
- **Employee_Search**: A text input that filters the direct reports list by employee name or email in real time.
- **Filter_Bar**: A set of controls that narrow the direct reports list by one or more criteria simultaneously.
- **At_Risk**: An employee with `is_at_risk = 1`, indicating two consecutive low sentiment scores.
- **Sentiment_Score**: A numeric score (1–5) from the employee's most recent completed check-in.
- **Struggle_Type**: The classification of an employee's most recent check-in: `HUMAN`, `TECHNICAL`, `BOTH`, or `NONE`.
- **Peer_Score**: The aggregated score from approved peer reviews for an employee (added in the peer-review-per-employee feature).
- **Report**: A direct report object returned by `GET /api/manager/reports`.

## Requirements

### Requirement 1: Team Summary Dashboard

**User Story:** As a manager, I want to see a summary of my team's health at a glance, so that I can quickly identify areas that need attention without scrolling through every employee card.

#### Acceptance Criteria

1. WHEN the Manager_View loads, THE Team_Dashboard SHALL display the total number of direct reports.
2. THE Team_Dashboard SHALL display the count of employees currently flagged as At_Risk.
3. THE Team_Dashboard SHALL display the team average Sentiment_Score, calculated as the mean of all non-null `latestSentimentScore` values across direct reports, rounded to one decimal place.
4. THE Team_Dashboard SHALL display the team average Peer_Score, calculated as the mean of all non-null `peerScore` values across direct reports, rounded to one decimal place.
5. WHEN all employees have null `latestSentimentScore`, THE Team_Dashboard SHALL display "—" instead of a numeric average.
6. THE Team_Dashboard SHALL display the count of pending peer reviews (reviews with status `pending_reviewer` or `pending_manager`).

### Requirement 2: Employee Name/Email Search

**User Story:** As a manager, I want to search for an employee by name or email, so that I can quickly navigate to a specific person's card without scrolling.

#### Acceptance Criteria

1. THE Manager_View SHALL render a text input field above the direct reports list labelled "Search employees…".
2. WHEN the manager types in the search input, THE Manager_View SHALL filter the displayed direct reports list in real time to show only employees whose `name` or `email` contains the search string (case-insensitive).
3. WHEN the search input is empty, THE Manager_View SHALL display all direct reports.
4. WHEN no employees match the search string, THE Manager_View SHALL display a "No employees match your search" empty state message.
5. THE search filter SHALL be applied client-side without any additional API calls.

### Requirement 3: At-Risk Filter

**User Story:** As a manager, I want to filter my team to show only at-risk employees, so that I can focus my attention on the people who need the most support.

#### Acceptance Criteria

1. THE Filter_Bar SHALL include an "At Risk" toggle button.
2. WHEN the "At Risk" toggle is active, THE Manager_View SHALL display only employees with `atRisk === true`.
3. WHEN the "At Risk" toggle is inactive, THE Manager_View SHALL display all employees (subject to other active filters).
4. THE "At Risk" toggle SHALL display the count of at-risk employees in its label (e.g. "At Risk (2)").

### Requirement 4: Sentiment Score Range Filter

**User Story:** As a manager, I want to filter employees by sentiment score range, so that I can focus on employees with low scores or celebrate those with high scores.

#### Acceptance Criteria

1. THE Filter_Bar SHALL include a sentiment score range selector with options: "All", "Low (1–2.9)", "Medium (3–3.9)", "High (4–5)".
2. WHEN a range is selected, THE Manager_View SHALL display only employees whose `latestSentimentScore` falls within that range.
3. WHEN "All" is selected, THE Manager_View SHALL display all employees regardless of sentiment score.
4. WHEN an employee has a null `latestSentimentScore`, they SHALL be excluded from "Low", "Medium", and "High" filter results but SHALL appear when "All" is selected.

### Requirement 5: Struggle Type Filter

**User Story:** As a manager, I want to filter employees by their most recent struggle type, so that I can identify patterns across the team.

#### Acceptance Criteria

1. THE Filter_Bar SHALL include a struggle type selector with options: "All", "Human", "Technical", "Both", "None".
2. WHEN a struggle type is selected, THE Manager_View SHALL display only employees whose most recent check-in `struggleType` matches the selected value.
3. WHEN "All" is selected, THE Manager_View SHALL display all employees regardless of struggle type.
4. THE struggle type filter SHALL be applied client-side using data already available in the `reports` state.

### Requirement 6: Combined Filter Behaviour

**User Story:** As a manager, I want multiple filters to work together, so that I can narrow down to a very specific subset of employees.

#### Acceptance Criteria

1. WHEN multiple filters are active simultaneously, THE Manager_View SHALL display only employees that satisfy ALL active filter criteria (AND logic).
2. THE search input and all filter controls SHALL be combinable — e.g. searching "alex" while "At Risk" is active shows only at-risk employees whose name/email contains "alex".
3. THE Manager_View SHALL display the count of currently visible employees after filtering (e.g. "Showing 2 of 4 employees").
4. THE Filter_Bar SHALL include a "Clear filters" button that resets all active filters and the search input to their default state.
5. WHEN all filters are at their default state, THE "Clear filters" button SHALL be hidden or disabled.

### Requirement 7: Filter and Search State Persistence Within Session

**User Story:** As a manager, I want my search and filter state to persist while I interact with employee cards, so that I don't lose my filter context when expanding or collapsing a card.

#### Acceptance Criteria

1. WHEN the manager expands or collapses an employee card, THE active search and filter state SHALL remain unchanged.
2. WHEN a peer review is approved and the reports list refreshes, THE active search and filter state SHALL be reapplied to the updated list.
3. THE search and filter state SHALL be stored in component state (not persisted across extension restarts).
