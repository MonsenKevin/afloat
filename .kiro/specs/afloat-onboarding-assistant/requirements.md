# Requirements Document

## Introduction

Afloat is an AI-powered personal assistant for new employees in the post-onboarding phase, delivered as a **Chrome Extension**. At its core, Afloat operates as each employee's personal **Mission_Control** — a calm, intelligent co-pilot that is always on, always watching for turbulence, and always ready to route the employee to exactly the right resource, whether that is a person, a document, or a piece of code.

Like a sophisticated AI flight director monitoring a mission in real time, Mission_Control does not wait to be asked. It tracks engagement signals, surfaces friction before it becomes failure, and responds with precision — connecting a struggling employee to a culture champion, a knowledge base answer, or a relevant code contact depending on the nature of the struggle. The interface lives in the browser as a popup or pinned side panel, so employees never have to leave their workflow to get support.

Afloat conducts biweekly check-ins anchored to the company's configured culture values, classifies the type of struggle a new employee is experiencing, and routes them intelligently based on that classification. The goal is timely, proactive, personalized support — without requiring employees to leave their browser.

This spec is scoped for a 7-hour hackathon prototype.

---

## Glossary

- **Afloat**: The AI onboarding assistant system described in this document, delivered as a Chrome Extension.
- **Extension**: The Afloat Chrome Extension installed from the Chrome Web Store or loaded as an unpacked extension.
- **Popup**: The default Extension UI mode — a compact panel (400×600px) that opens when the user clicks the Afloat toolbar icon and closes when focus is lost.
- **Side_Panel**: The pinned Extension UI mode — a persistent panel docked to the side of the Chrome window using the Chrome Side Panel API, remaining visible while the user browses.
- **New_Employee**: A user who has recently joined the company and is in the post-onboarding phase (first 90 days).
- **Manager**: A secondary user who oversees one or more New_Employees and can view at-risk signals and attrition cost data.
- **Check_In**: A biweekly (every two weeks / every sprint) structured conversation initiated by Afloat to collect sentiment and engagement data from a New_Employee.
- **Sentiment_Score**: A numeric value (1–5) derived from a Check_In response representing the New_Employee's current engagement level.
- **At_Risk_Employee**: A New_Employee whose Sentiment_Score or engagement pattern indicates a high probability of voluntary attrition.
- **Knowledge_Base**: A company-maintained repository of documents covering processes, culture, and team practices.
- **GitHub_Blame**: The Git blame metadata identifying the most recent contributors to a given code file or repository.
- **Contact_Suggestion**: A person surfaced by Afloat as a recommended point of contact based on GitHub_Blame data.
- **Badge**: A Chrome Extension toolbar icon badge displaying a numeric count or indicator to draw the user's attention.
- **Mission_Control**: The name for Afloat's AI persona — a calm, intelligent co-pilot that guides New_Employees through their onboarding journey, monitors for friction, and routes them to the right resource at the right time.
- **Culture_Value**: A specific company value or principle configured in the Knowledge_Base (e.g., "Customer Obsession", "Bias for Action").
- **Culture_Champion**: An employee designated as a mentor or exemplar for one or more Culture_Values, surfaced by Afloat as a suggested contact when a New_Employee is experiencing a human or cultural struggle.
- **Struggle_Type**: An enum classification of a New_Employee's primary friction — either `HUMAN` (cultural or relational) or `TECHNICAL` (deliverable, code, or process).

---

## Requirements

### Requirement 1: Chrome Extension Installation and Launch

**User Story:** As a New_Employee or Manager, I want to install Afloat as a Chrome Extension and open it from my toolbar, so that I can access the assistant without leaving my browser or switching to a separate app.

#### Acceptance Criteria

1. THE Extension SHALL be installable in Chrome via an unpacked load (developer mode) for the hackathon prototype.
2. WHEN the Extension is installed, THE Extension SHALL add an Afloat icon to the Chrome toolbar.
3. WHEN a user clicks the Afloat toolbar icon, THE Extension SHALL open the Popup displaying the Afloat interface.
4. WHEN the Popup is open and the user clicks outside of it, THE Extension SHALL close the Popup without losing unsaved conversation state.
5. THE Extension SHALL persist conversation state in Chrome local storage so that reopening the Popup restores the previous session.
6. WHEN a Check_In or proactive outreach is pending, THE Extension SHALL display a Badge on the toolbar icon indicating the number of pending notifications.

---

### Requirement 2: Side Panel Pinning

**User Story:** As a New_Employee, I want to pin Afloat as a side panel so that I can keep it visible while I work in other browser tabs, without having to reopen the popup repeatedly.

#### Acceptance Criteria

1. THE Extension SHALL include a "Pin to Side Panel" control within the Popup UI.
2. WHEN a user activates the "Pin to Side Panel" control, THE Extension SHALL open the Afloat interface in the Chrome Side_Panel using the Chrome Side Panel API, and close the Popup.
3. WHILE the Side_Panel is open, THE Extension SHALL keep the Afloat interface visible and interactive as the user navigates between browser tabs.
4. WHEN a user closes the Side_Panel, THE Extension SHALL revert to Popup mode for subsequent toolbar icon clicks.
5. THE Extension SHALL render all features (check-ins, Q&A, dashboards) identically in both Popup and Side_Panel modes, adapting layout to the available width.

---

### Requirement 3: Biweekly Check-In

**User Story:** As a New_Employee, I want Afloat to check in with me every sprint using questions grounded in my company's culture values, so that I have a consistent space to reflect on how I am connecting with the team, embodying company principles, and progressing on real work.

#### Acceptance Criteria

1. WHEN two weeks have elapsed since the last Check_In (or since the New_Employee's start date for the first Check_In), THE Afloat SHALL initiate a Check_In conversation with the New_Employee.
2. WHEN a Check_In is due, THE Extension SHALL display a Badge on the toolbar icon to prompt the New_Employee to open Afloat.
3. THE Afloat SHALL present the New_Employee with a structured set of questions during each Check_In covering: (a) their affinity or struggle with one or more specific Culture_Values configured in the Knowledge_Base, (b) their sense of human connection and belonging within their team, and (c) their progress on tangible deliverables or technical work.
4. WHEN generating Check_In questions, THE Afloat SHALL select Culture_Values from the Knowledge_Base so that questions are specific to the company's configured principles rather than generic.
5. WHEN a New_Employee submits Check_In responses, THE Afloat SHALL compute a Sentiment_Score between 1 and 5 from those responses and persist it with a timestamp.
6. IF a New_Employee does not respond to a Check_In within 48 hours, THEN THE Afloat SHALL send one follow-up reminder by updating the Badge count and displaying a reminder message the next time the Popup or Side_Panel is opened.
7. THE Afloat SHALL store all Check_In responses and Sentiment_Scores in a per-employee history accessible to the New_Employee and their Manager.

---

### Requirement 4: Struggle Classification and Intelligent Routing

**User Story:** As a New_Employee who has just completed a Check_In, I want Afloat to understand what kind of friction I am experiencing and route me to the right resource, so that I get targeted help rather than generic suggestions.

#### Acceptance Criteria

1. WHEN a New_Employee submits Check_In responses, THE Afloat SHALL classify the New_Employee's primary friction as a Struggle_Type of either `HUMAN` or `TECHNICAL` based on the content of those responses.
2. WHEN the Struggle_Type is `HUMAN`, THE Afloat SHALL identify the specific Culture_Value or Culture_Values with which the New_Employee is struggling and surface one or more Culture_Champions associated with those values as suggested contacts.
3. WHEN the Struggle_Type is `HUMAN`, THE Afloat SHALL personalize the Culture_Champion suggestions to the specific Culture_Value causing friction, rather than returning a generic list of mentors.
4. WHEN the Struggle_Type is `TECHNICAL`, THE Afloat SHALL activate the Knowledge_Base Q&A and GitHub_Blame contact surfacing to provide direct answers and relevant contacts related to the New_Employee's stated deliverable or technical blocker.
5. WHEN a Check_In response indicates both `HUMAN` and `TECHNICAL` friction, THE Afloat SHALL classify both Struggle_Types and execute the routing actions for each simultaneously.
6. THE Afloat SHALL present routing suggestions within the same Check_In conversation thread so that the New_Employee receives them without navigating away.

---

### Requirement 5: Knowledge Base Q&A

**User Story:** As a New_Employee, I want to ask Afloat questions about company processes, culture, and team practices, so that I can find answers without interrupting colleagues.

#### Acceptance Criteria

1. WHEN a New_Employee submits a natural-language question, THE Afloat SHALL query the Knowledge_Base and return a relevant answer within 5 seconds.
2. WHEN the Knowledge_Base contains no document relevant to the question, THE Afloat SHALL inform the New_Employee that no answer was found and suggest they ask a team member.
3. THE Afloat SHALL include a citation (document title and section) alongside every answer retrieved from the Knowledge_Base.
4. WHERE the company has configured Amazon Leadership Principles content in the Knowledge_Base, THE Afloat SHALL be able to answer questions about those principles using that content.

---

### Requirement 6: GitHub Blame Contact Surfacing

**User Story:** As a New_Employee, I want Afloat to tell me who recently worked on a piece of code, so that I know who to ask when I have questions about a specific repository or file.

#### Acceptance Criteria

1. WHEN a New_Employee asks who to contact about a specific repository or file path, THE Afloat SHALL query GitHub_Blame data for that repository or file and return a list of Contact_Suggestions.
2. THE Afloat SHALL rank Contact_Suggestions by recency of contribution, with the most recent contributor listed first.
3. THE Afloat SHALL include each Contact_Suggestion's name, GitHub username, and the date of their most recent commit to the queried file or repository.
4. IF the queried repository or file path does not exist or is inaccessible, THEN THE Afloat SHALL return a descriptive error message to the New_Employee.

---

### Requirement 7: Proactive At-Risk Detection and Outreach

**User Story:** As a New_Employee who may be struggling, I want Afloat to proactively reach out with helpful resources before I disengage, so that I get support at the right moment.

#### Acceptance Criteria

1. WHEN a New_Employee's Sentiment_Score falls below 3 on any Check_In, THE Afloat SHALL flag that New_Employee as an At_Risk_Employee.
2. WHEN a New_Employee is flagged as an At_Risk_Employee, THE Afloat SHALL surface a proactive outreach message the next time the Popup or Side_Panel is opened, containing at least one relevant resource (Knowledge_Base article, suggested contact, or manager introduction), within 24 hours of the triggering Check_In.
3. WHILE a New_Employee is flagged as an At_Risk_Employee, THE Afloat SHALL increase Check_In frequency to weekly until two consecutive Check_Ins return a Sentiment_Score of 3 or higher.
4. WHEN a New_Employee's Sentiment_Score returns to 3 or higher for two consecutive Check_Ins, THE Afloat SHALL remove the At_Risk_Employee flag and revert Check_In frequency to biweekly.
5. IF a New_Employee's Sentiment_Score falls below 2 on two consecutive Check_Ins, THEN THE Afloat SHALL notify the New_Employee's Manager with the at-risk signal.

---

### Requirement 8: Employee Engagement History

**User Story:** As a New_Employee, I want to see my own engagement history over time, so that I can reflect on my onboarding journey and track my own growth.

#### Acceptance Criteria

1. THE Afloat SHALL provide each New_Employee with a personal dashboard displaying all past Check_In dates, Sentiment_Scores, and submitted responses.
2. WHEN a New_Employee views their dashboard, THE Afloat SHALL render a Sentiment_Score trend line covering all completed Check_Ins.
3. THE Afloat SHALL allow a New_Employee to add a free-text note to any past Check_In entry.

---

### Requirement 9: Authentication and Role-Based Access

**User Story:** As a user of Afloat, I want access to be controlled by role, so that New_Employees cannot see other employees' data and Managers can only see their direct reports.

#### Acceptance Criteria

1. THE Afloat SHALL require all users to authenticate before accessing any feature.
2. WHEN the Extension is opened for the first time after installation, THE Extension SHALL present a login screen within the Popup before displaying any Afloat content.
3. WHEN a user is authenticated, THE Extension SHALL persist the authentication token in Chrome local storage so that subsequent Popup or Side_Panel opens do not require re-login within the same session.
4. WHEN a New_Employee is authenticated, THE Afloat SHALL restrict data access to that New_Employee's own Check_In history, Sentiment_Scores, and interactions.
5. WHEN a Manager is authenticated, THE Afloat SHALL restrict data access to Check_In summaries and Sentiment_Score trends for that Manager's direct reports only.
6. IF an authenticated user attempts to access data outside their permitted scope, THEN THE Afloat SHALL return an authorization error and log the attempt.
