# Requirements Document

## Introduction

This feature enhances the employee-facing chat experience in Mission Control by making AI responses more transparent and actionable. When the AI draws from the knowledge base (KB) to answer a question, it will clearly surface which KB document(s) and section(s) it used as sources. When the AI response involves a culture value or a human struggle topic, it will attach a relevant culture champion — a real person the employee can reach out to for further help.

The goal is twofold: build trust by showing employees exactly where AI answers come from, and bridge the gap between AI guidance and human connection when the topic is personal or culture-related.

## Glossary

- **Chat**: The employee-facing conversational interface in the Mission Control browser extension.
- **KB (Knowledge Base)**: The collection of Markdown documents (e.g., engineering-onboarding.md, team-culture.md) loaded by the `kbLoader` service and queried via `vectorStore`.
- **KB_Source**: A structured reference to a KB document and section that the AI used when generating a response (e.g., "Engineering Onboarding > Section 3: Dev Environment Setup").
- **Culture_Champion**: A designated employee who is associated with one or more company culture values and is available to support peers on human/cultural topics.
- **StructuredAnswer**: The JSON response shape returned by `queryKB` in `vectorStore.ts`, containing `answer`, `contacts`, and `documents` fields.
- **RoutingResult**: The backend type that aggregates KB answers, culture champions, and GitHub contacts for a given check-in or chat response.
- **Chat_Message**: A single message in the chat thread, stored in `chatStore`, with optional `data` payload carrying contacts, documents, and GitHub contacts.
- **Struggle_Type**: A classification of an employee's difficulty: `HUMAN`, `TECHNICAL`, `BOTH`, or `NONE`.
- **Mission_Control**: The AI onboarding co-pilot system.

---

## Requirements

### Requirement 1: KB Source Attribution in Chat Responses

**User Story:** As a new employee, I want to see which knowledge base documents the AI used to answer my question, so that I can verify the information and read the full source for more context.

#### Acceptance Criteria

1. WHEN `queryKB` returns a `StructuredAnswer` with a non-empty `documents` array, THE Chat_Message SHALL include a `documents` field containing each referenced KB_Source with its `title` and `section`.
2. THE Chat component SHALL render each KB_Source as a distinct, visually styled chip below the AI answer bubble, displaying the document title and section in the format `<title> › <section>`.
3. WHEN `queryKB` returns a `StructuredAnswer` with an empty `documents` array, THE Chat component SHALL NOT render any source attribution section for that message.
4. THE Chat component SHALL label the source attribution section with the heading "Sources" to distinguish it from other message metadata.
5. WHEN a KB_Source chip is rendered, THE Chat component SHALL display a document icon alongside the source text to provide a visual affordance that the content is from a document.

---

### Requirement 2: Culture Champion Attachment for Human and Culture Topics

**User Story:** As a new employee, I want to be connected to a real culture champion when the AI's response touches on a culture value or a human struggle, so that I can get personal support beyond what the AI can provide.

#### Acceptance Criteria

1. WHEN the AI response is generated for a question classified with `Struggle_Type` of `HUMAN` or `BOTH`, THE Mission_Control backend SHALL include relevant `CultureChampion` records in the chat response payload.
2. WHEN `queryKB` returns contacts that include a culture champion (identified by matching a known culture value name), THE Chat_Message SHALL include those champions in its `contacts` data field.
3. THE Chat component SHALL render each culture champion as a contact card below the AI answer bubble, displaying the champion's name, email as a mailto link, and a reason for the connection.
4. THE Chat component SHALL label the culture champion section with the heading "People to talk to" to distinguish it from KB source attribution.
5. WHEN no culture champions are relevant to the response, THE Chat component SHALL NOT render the "People to talk to" section.
6. WHEN a culture champion card is rendered, THE Chat component SHALL display the champion's name initial as an avatar to provide a visual identity cue.

---

### Requirement 3: Chat API Response Carries Attribution Data

**User Story:** As a developer, I want the chat API endpoint to return structured KB source and culture champion data alongside the answer text, so that the frontend can render attribution without additional requests.

#### Acceptance Criteria

1. THE chat API endpoint SHALL return a response payload that includes an `answer` string, a `documents` array of KB_Source objects, and a `contacts` array of contact objects in a single response.
2. WHEN `queryKB` produces a `StructuredAnswer`, THE chat API endpoint SHALL map the `documents` field to the response payload without modification.
3. WHEN `queryKB` produces a `StructuredAnswer`, THE chat API endpoint SHALL map the `contacts` field to the response payload without modification.
4. IF `queryKB` returns `null` or throws an error, THEN THE chat API endpoint SHALL return an `answer` of `"I don't have enough information to answer that. Try asking a teammate."` with empty `documents` and `contacts` arrays.
5. THE chat API endpoint SHALL respond within 10 seconds for any employee query under normal operating conditions.

---

### Requirement 4: KB Source Data Integrity

**User Story:** As a new employee, I want the source citations shown in chat to accurately reflect the documents the AI actually used, so that I can trust the attribution is not fabricated.

#### Acceptance Criteria

1. THE Mission_Control backend SHALL only include a KB_Source in the `documents` array if the corresponding document title and section exist in the loaded KB document set returned by `getKbDocuments`.
2. WHEN the KB directory contains no documents, THE Mission_Control backend SHALL return an empty `documents` array and SHALL NOT fabricate KB_Source entries.
3. THE `StructuredAnswer` `documents` field SHALL contain only objects with a non-empty `title` string and a non-empty `section` string.
4. FOR ALL valid KB queries, parsing the `StructuredAnswer` JSON then re-serializing it then parsing it again SHALL produce an equivalent object (round-trip property).

---

### Requirement 5: Culture Champion Data Integrity

**User Story:** As a new employee, I want the culture champions shown in chat to be real, active employees associated with the relevant culture value, so that I can reach out to someone who is genuinely prepared to help.

#### Acceptance Criteria

1. THE Mission_Control backend SHALL only surface a `CultureChampion` in a chat response if that champion's `culture_value_id` matches a culture value implicated by the AI classification.
2. WHEN no culture champions exist in the database for the implicated culture values, THE Mission_Control backend SHALL return an empty `contacts` array and SHALL NOT fabricate champion entries.
3. THE `CultureChampion` object included in a chat response SHALL contain a non-empty `name`, a valid `email` address, and a non-empty `cultureValueName`.
4. WHEN a culture champion's email is present, THE Chat component SHALL render it as a `mailto:` hyperlink so the employee can initiate contact directly.

---

### Requirement 6: Attribution Visibility in Check-In Routing

**User Story:** As a new employee completing a check-in, I want to see KB sources and culture champions in the routing result card, so that the same transparency and human-connection features apply to check-in responses as to direct chat questions.

#### Acceptance Criteria

1. WHEN a check-in is submitted and the `RoutingResult` contains `kbAnswers` with citations, THE RoutingCard component SHALL display the cited KB documents as source chips using the same visual style as the Chat component.
2. WHEN a check-in is submitted and the `RoutingResult` contains `cultureChampions`, THE RoutingCard component SHALL display the champions as contact cards using the same visual style as the Chat component.
3. THE `RoutingResult` `kbAnswers` field SHALL include a `citation` string in the format `<title> > <section>` for each KB document used.
4. WHEN `buildRoutingResult` constructs a `RoutingResult` for a `TECHNICAL` or `BOTH` struggle type, THE Mission_Control backend SHALL populate `kbAnswers` from the `queryKB` response `documents` field.
