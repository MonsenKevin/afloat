# Requirements Document

## Introduction

This feature allows organizations to connect external tools and knowledge sources — Jira, GitHub, Outlook, Google Calendar, Granola, and a static knowledge base — so that the Mission Control AI assistant can search across all of them when answering employee queries. Org admins (Managers) configure which integrations are active and supply the necessary credentials or OAuth tokens. When an employee asks a question in the chat, the AI retrieves relevant context from every enabled source and synthesizes a grounded, attributed answer.

The feature extends the existing `vectorStore`/`kbLoader` pipeline: instead of only loading static Markdown files from `data/kb/`, the system also fetches and indexes live data from connected integrations. The existing `queryKB` function and `/api/kb/ask` endpoint are extended to include this richer context.

---

## Glossary

- **Integration**: A configured connection between Mission Control and an external data source (Jira, GitHub, Outlook, Google Calendar, Granola, or the static KB).
- **Integration_Provider**: The external service being connected. Valid values: `jira`, `github`, `outlook`, `google_calendar`, `granola`, `knowledge_base`.
- **Integration_Config**: A per-org record that stores the provider type, connection credentials or OAuth tokens, enabled/disabled status, and sync metadata.
- **Org**: An organization whose members share a set of Integration_Configs. Identified by `org_id` on the `users` table.
- **Connector**: A backend service module responsible for fetching and normalizing data from one Integration_Provider into `IndexedDocument` objects.
- **IndexedDocument**: A normalized, provider-agnostic document unit with fields: `id`, `orgId`, `provider`, `sourceId`, `title`, `content`, `url`, `fetchedAt`.
- **Integration_Index**: The in-memory (or persisted) collection of `IndexedDocument` objects for an org, queried by `queryKB` at answer time.
- **Sync**: The process of fetching fresh data from a Connector and updating the Integration_Index.
- **Mission_Control**: The AI onboarding co-pilot system (backend + Chrome extension).
- **Admin**: A user with the `Manager` role who has permission to manage Integration_Configs for their org.
- **OAuth_Token**: An access token obtained via an OAuth 2.0 flow, used to authenticate against Jira, Outlook, or Google Calendar.
- **API_Key**: A static credential used to authenticate against GitHub or Granola.
- **KB_Doc**: A static Markdown document loaded from `data/kb/` by the existing `kbLoader` service.

---

## Requirements

### Requirement 1: Integration Configuration Management

**User Story:** As an admin, I want to add, update, enable, disable, and remove integrations for my org, so that I can control which external sources the AI draws from.

#### Acceptance Criteria

1. THE Integration_Config_API SHALL expose endpoints to create, read, update, and delete Integration_Configs scoped to the authenticated admin's org.
2. WHEN an admin submits a create request with a valid `provider` and credentials, THE Integration_Config_API SHALL persist the Integration_Config with `status` set to `disabled` and return the created record.
3. WHEN an admin submits a create request with an unsupported `provider` value, THE Integration_Config_API SHALL return HTTP 400 with a descriptive error message.
4. WHEN an admin submits a create request with missing required credential fields for the given provider, THE Integration_Config_API SHALL return HTTP 400 listing the missing fields.
5. WHEN an admin enables an Integration_Config, THE Integration_Config_API SHALL set `status` to `active` and trigger an initial Sync for that integration.
6. WHEN an admin disables an Integration_Config, THE Integration_Config_API SHALL set `status` to `disabled` and THE Mission_Control backend SHALL exclude that integration's documents from all subsequent queries.
7. WHEN an admin deletes an Integration_Config, THE Mission_Control backend SHALL remove all associated IndexedDocuments from the Integration_Index for that org.
8. THE Integration_Config_API SHALL require the `Manager` role; requests from `New_Employee` users SHALL receive HTTP 403.

---

### Requirement 2: Credential Storage and Security

**User Story:** As an admin, I want my integration credentials stored securely, so that API keys and OAuth tokens are not exposed to unauthorized parties.

#### Acceptance Criteria

1. THE Mission_Control backend SHALL store OAuth_Tokens and API_Keys encrypted at rest using AES-256 encryption before writing them to the database.
2. THE Integration_Config_API SHALL never return raw credential values in any API response; credential fields SHALL be replaced with a masked placeholder (e.g., `"••••••••"`).
3. WHEN an OAuth_Token expires, THE Mission_Control backend SHALL use the stored refresh token to obtain a new access token without requiring admin re-authentication, provided a valid refresh token exists.
4. IF an OAuth_Token refresh attempt fails, THEN THE Mission_Control backend SHALL set the Integration_Config `status` to `error` and SHALL log the failure with a non-sensitive error message.
5. THE Mission_Control backend SHALL validate that credential values are non-empty strings before persisting an Integration_Config.

---

### Requirement 3: Jira Connector

**User Story:** As an employee, I want the AI to draw from our Jira project data when answering questions about tasks, tickets, and project status, so that I get accurate, up-to-date answers grounded in real work items.

#### Acceptance Criteria

1. WHEN the Jira integration is `active`, THE Jira_Connector SHALL fetch open and recently closed issues from the configured Jira project using the Jira REST API v3.
2. THE Jira_Connector SHALL normalize each Jira issue into an IndexedDocument with `provider` set to `"jira"`, `title` set to the issue summary, `content` set to the issue description and comments, and `url` set to the issue's web URL.
3. WHEN a Jira issue has no description, THE Jira_Connector SHALL set `content` to the issue summary to ensure the IndexedDocument is non-empty.
4. THE Jira_Connector SHALL fetch issues updated within the last 90 days to limit index size.
5. IF the Jira API returns an authentication error (HTTP 401 or 403), THEN THE Jira_Connector SHALL set the Integration_Config `status` to `error` and SHALL NOT retry until the admin updates the credentials.
6. IF the Jira API returns a rate-limit error (HTTP 429), THEN THE Jira_Connector SHALL wait the duration specified in the `Retry-After` header before retrying, up to a maximum of 3 retries.

---

### Requirement 4: GitHub Connector

**User Story:** As an employee, I want the AI to draw from our GitHub repositories when answering questions about code, pull requests, and technical decisions, so that I can find relevant context without leaving the assistant.

#### Acceptance Criteria

1. WHEN the GitHub integration is `active`, THE GitHub_Connector SHALL fetch open pull requests, recently merged pull requests, and README files from the configured repositories using the GitHub REST API.
2. THE GitHub_Connector SHALL normalize each pull request into an IndexedDocument with `provider` set to `"github"`, `title` set to the PR title, `content` set to the PR body and review comments, and `url` set to the PR's HTML URL.
3. THE GitHub_Connector SHALL normalize each README file into an IndexedDocument with `provider` set to `"github"`, `title` set to `"<repo> README"`, `content` set to the decoded file content, and `url` set to the repository's HTML URL.
4. THE GitHub_Connector SHALL fetch pull requests updated within the last 60 days to limit index size.
5. IF the GitHub API returns HTTP 401 or 403, THEN THE GitHub_Connector SHALL set the Integration_Config `status` to `error` and SHALL NOT retry until the admin updates the credentials.
6. IF the GitHub API returns HTTP 429, THEN THE GitHub_Connector SHALL wait the duration specified in the `X-RateLimit-Reset` header before retrying, up to a maximum of 3 retries.

---

### Requirement 5: Outlook Connector

**User Story:** As an employee, I want the AI to draw from relevant Outlook emails and threads when answering questions about decisions, announcements, and team communications, so that I can surface important context from my inbox.

#### Acceptance Criteria

1. WHEN the Outlook integration is `active`, THE Outlook_Connector SHALL fetch emails from the authenticated user's inbox and sent items using the Microsoft Graph API, scoped to messages received or sent within the last 30 days.
2. THE Outlook_Connector SHALL normalize each email into an IndexedDocument with `provider` set to `"outlook"`, `title` set to the email subject, `content` set to the email body (plain text), and `url` set to the email's web link.
3. WHEN an email body is in HTML format, THE Outlook_Connector SHALL strip HTML tags before storing the content in the IndexedDocument.
4. THE Outlook_Connector SHALL exclude emails where the subject and body are both empty.
5. IF the Microsoft Graph API returns HTTP 401, THEN THE Outlook_Connector SHALL attempt to refresh the OAuth_Token once; IF the refresh fails, THEN THE Outlook_Connector SHALL set the Integration_Config `status` to `error`.
6. THE Outlook_Connector SHALL fetch a maximum of 200 emails per Sync to limit index size and API cost.

---

### Requirement 6: Google Calendar Connector

**User Story:** As an employee, I want the AI to draw from my Google Calendar events when answering questions about meetings, schedules, and upcoming commitments, so that I can get context-aware answers about my time.

#### Acceptance Criteria

1. WHEN the Google Calendar integration is `active`, THE Google_Calendar_Connector SHALL fetch calendar events from the authenticated user's primary calendar using the Google Calendar API, scoped to events occurring within 14 days before and 30 days after the current date.
2. THE Google_Calendar_Connector SHALL normalize each event into an IndexedDocument with `provider` set to `"google_calendar"`, `title` set to the event summary, `content` set to the event description and attendee names, and `url` set to the event's HTML link.
3. WHEN a calendar event has no description, THE Google_Calendar_Connector SHALL set `content` to the event summary and attendee names.
4. THE Google_Calendar_Connector SHALL exclude events with no summary and no attendees.
5. IF the Google Calendar API returns HTTP 401, THEN THE Google_Calendar_Connector SHALL attempt to refresh the OAuth_Token once; IF the refresh fails, THEN THE Google_Calendar_Connector SHALL set the Integration_Config `status` to `error`.
6. THE Google_Calendar_Connector SHALL fetch a maximum of 500 events per Sync to limit index size.

---

### Requirement 7: Granola Connector

**User Story:** As an employee, I want the AI to draw from Granola meeting notes when answering questions about past discussions and decisions, so that I can quickly recall what was said in meetings.

#### Acceptance Criteria

1. WHEN the Granola integration is `active`, THE Granola_Connector SHALL fetch meeting note documents from the Granola API using the configured API_Key.
2. THE Granola_Connector SHALL normalize each meeting note into an IndexedDocument with `provider` set to `"granola"`, `title` set to the meeting title, `content` set to the note body, and `url` set to the note's permalink.
3. THE Granola_Connector SHALL fetch notes created or updated within the last 60 days to limit index size.
4. WHEN a Granola note has no body content, THE Granola_Connector SHALL set `content` to the meeting title to ensure the IndexedDocument is non-empty.
5. IF the Granola API returns HTTP 401 or 403, THEN THE Granola_Connector SHALL set the Integration_Config `status` to `error` and SHALL NOT retry until the admin updates the API_Key.
6. IF the Granola API returns HTTP 429, THEN THE Granola_Connector SHALL wait 60 seconds before retrying, up to a maximum of 3 retries.

---

### Requirement 8: Knowledge Base Connector

**User Story:** As an employee, I want the AI to continue drawing from the static knowledge base Markdown files, so that existing curated content remains available alongside live integration data.

#### Acceptance Criteria

1. THE Knowledge_Base_Connector SHALL load all Markdown files from the `data/kb/` directory using the existing `loadKbDocuments` function and convert each `KbDoc` into an IndexedDocument with `provider` set to `"knowledge_base"`.
2. THE Knowledge_Base_Connector SHALL set `title` to the `KbDoc.title`, `content` to the `KbDoc.content`, and `url` to an empty string for static KB documents.
3. WHEN the `data/kb/` directory contains no Markdown files, THE Knowledge_Base_Connector SHALL return an empty array of IndexedDocuments and SHALL NOT throw an error.
4. THE Knowledge_Base_Connector SHALL be enabled by default for all orgs and SHALL NOT require admin credential configuration.

---

### Requirement 9: Integration Index and Search

**User Story:** As an employee, I want the AI to search across all enabled integrations simultaneously when I ask a question, so that I get the most relevant answer regardless of which tool the information lives in.

#### Acceptance Criteria

1. WHEN a query is received, THE Integration_Index SHALL return the top-K most relevant IndexedDocuments across all `active` integrations for the requesting user's org, where K is configurable and defaults to 20.
2. THE Integration_Index SHALL use semantic similarity (via the existing Claude-based `queryKB` approach) to rank IndexedDocuments by relevance to the query.
3. WHEN the Integration_Index contains documents from multiple providers, THE Mission_Control backend SHALL include documents from at least two different providers in the top-K results if documents from multiple providers are relevant.
4. THE Integration_Index SHALL be scoped per org: documents from one org SHALL NOT appear in query results for another org.
5. WHEN no IndexedDocuments are relevant to a query, THE Mission_Control backend SHALL return an answer indicating no relevant information was found, with empty `documents` and `contacts` arrays.
6. FOR ALL valid query strings, serializing the top-K IndexedDocument list to JSON then deserializing it SHALL produce an equivalent list (round-trip property).

---

### Requirement 10: Sync Scheduling

**User Story:** As an admin, I want integrations to stay up to date automatically, so that the AI always has reasonably fresh data without requiring manual re-syncs.

#### Acceptance Criteria

1. THE Sync_Scheduler SHALL trigger a Sync for each `active` Integration_Config on a configurable interval, defaulting to every 60 minutes.
2. WHEN a Sync is triggered for an integration, THE Sync_Scheduler SHALL update the `last_synced_at` timestamp on the Integration_Config upon successful completion.
3. IF a Sync fails for any reason, THEN THE Sync_Scheduler SHALL log the error with the integration ID and provider name, and SHALL retry after the next scheduled interval.
4. WHEN an admin enables a new integration, THE Sync_Scheduler SHALL trigger an immediate Sync for that integration before the next scheduled interval.
5. WHILE a Sync is in progress for an integration, THE Sync_Scheduler SHALL NOT trigger a second concurrent Sync for the same integration.

---

### Requirement 11: Attribution in Chat Responses

**User Story:** As an employee, I want to see which integration source each piece of information came from in the AI's answer, so that I can verify the information and navigate to the original source.

#### Acceptance Criteria

1. WHEN the AI answer draws from one or more IndexedDocuments, THE Mission_Control backend SHALL include each source in the `documents` array of the response, with `provider`, `title`, and `url` fields populated.
2. THE Chat component SHALL render each source attribution with a provider-specific icon (Jira, GitHub, Outlook, Google Calendar, Granola, or KB) alongside the document title.
3. WHEN a source has a non-empty `url`, THE Chat component SHALL render the source title as a hyperlink opening in a new tab.
4. WHEN a source has an empty `url` (e.g., static KB documents), THE Chat component SHALL render the source title as plain text without a hyperlink.
5. THE Chat component SHALL group source attributions by provider under a "Sources" heading, consistent with the existing KB attribution design.

---

### Requirement 12: Integration Status Dashboard (Admin UI)

**User Story:** As an admin, I want to see the status of all configured integrations in the extension UI, so that I can quickly identify and fix broken connections.

#### Acceptance Criteria

1. THE Integration_Dashboard component SHALL display a list of all Integration_Configs for the admin's org, showing provider name, `status` (`active`, `disabled`, `error`), and `last_synced_at` timestamp.
2. WHEN an Integration_Config has `status` of `error`, THE Integration_Dashboard component SHALL display a visual error indicator and a human-readable error message.
3. THE Integration_Dashboard component SHALL provide controls to enable, disable, and delete each integration.
4. THE Integration_Dashboard component SHALL provide a form to add a new integration, with provider-specific credential fields rendered based on the selected provider.
5. WHEN an admin submits the add-integration form with invalid or missing credentials, THE Integration_Dashboard component SHALL display inline validation errors without submitting the form.
6. THE Integration_Dashboard component SHALL be accessible only to users with the `Manager` role; `New_Employee` users SHALL NOT see the integration management UI.

