import Anthropic from '@anthropic-ai/sdk';
import { getKbDocuments } from './kbLoader';
import { indexService } from './integrationIndex';
import { StructuredDocument } from '../types';

const MODEL = 'claude-haiku-4-5-20251001';

const TOP_K_INTEGRATION_DOCS = parseInt(process.env.TOP_K_INTEGRATION_DOCS ?? '20', 10);

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment');
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export interface StructuredAnswer {
  answer: string;
  primaryDoc?: StructuredDocument | null;
  contacts: { name: string; email?: string; reason: string }[];
  documents: StructuredDocument[];
}

export async function queryKB(
  question: string,
  checkinContext?: string | null,
  conversationHistory?: string | null,
  isManager?: boolean,
  orgId?: string | null,
): Promise<StructuredAnswer | null> {
  const docs = getKbDocuments();

  const kbContext = docs.length > 0
    ? docs.map(d => `[${d.title} > ${d.section}]\n${d.content}`).join('\n\n---\n\n')
    : null;

  const contextSections: string[] = [];
  if (kbContext) contextSections.push(`KNOWLEDGE BASE:\n${kbContext}`);

  // Fetch and rank integration docs when orgId is provided
  if (orgId) {
    try {
      const allIntegrationDocs = await indexService.getAll(orgId);

      if (allIntegrationDocs.length > 0) {
        // Rank by keyword overlap: count how many words from the question appear in title + content
        const questionWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 0);

        const ranked = allIntegrationDocs
          .map(doc => {
            const haystack = (doc.title + ' ' + doc.content).toLowerCase();
            const score = questionWords.reduce((acc, word) => acc + (haystack.includes(word) ? 1 : 0), 0);
            return { doc, score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, TOP_K_INTEGRATION_DOCS)
          .map(({ doc }) => doc);

        if (ranked.length > 0) {
          const integrationContext = ranked
            .map(doc => {
              const label = `[${doc.provider} > ${doc.sourceId}] ${doc.title}`;
              return `${label}\n${doc.content}`;
            })
            .join('\n\n---\n\n');

          contextSections.push(`INTEGRATION SOURCES:\n${integrationContext}`);
        }
      }
    } catch (err) {
      console.error('[queryKB] Failed to fetch integration docs for org', orgId, err);
      // Graceful fallback: continue with KB-only context
    }
  }

  if (checkinContext) contextSections.push(isManager ? `TEAM CHECK-IN DATA:\n${checkinContext}` : `YOUR RECENT CHECK-INS:\n${checkinContext}`);
  if (conversationHistory) contextSections.push(`RECENT CONVERSATION:\n${conversationHistory}`);

  const roleInstruction = isManager
    ? 'You are speaking with a MANAGER. Give team-level insights. Be specific about individuals when relevant. Be professional and constructive.'
    : 'You are speaking with a new employee. Give personalized, supportive guidance.';

  const systemPrompt = `You are Mission Control, an AI onboarding co-pilot. ${roleInstruction}

Return ONLY valid JSON in this exact shape:
{
  "answer": "<conversational 1-3 sentence response that names contributors if known, e.g. 'This feature was last worked on by [Name] and [Name].'>",
  "primaryDoc": {
    "title": "<single most relevant document or resource title>",
    "section": "<section name if applicable, otherwise empty string>",
    "provider": "<provider: jira | github | outlook | google_calendar | granola | knowledge_base>",
    "url": "<url if available, otherwise empty string>",
    "description": "<one sentence describing why this doc is the best starting point>"
  },
  "contacts": [
    { "name": "<full name>", "email": "<email if known>", "reason": "<specific reason to reach out, include recency if known e.g. 'updated this 3 days ago'>" }
  ],
  "documents": [
    { "title": "<document title>", "section": "<section name>", "provider": "<provider>", "url": "<url if available>" }
  ]
}

Rules:
- "answer" should feel conversational and direct — name contributors by first name when known, mention the feature/file context
- "primaryDoc" is the single best document to start with — pick the most relevant one. Set to null if no documents are relevant.
- "contacts" should be the 1-2 most relevant people — include how recently they worked on it when that info is available
- "documents" lists ALL sources used (including the primaryDoc) — leave empty array [] if none used
- Never use markdown, bullet points, or headers in the "answer" field
- If you cannot answer, set answer to "I don't have enough context on that yet. Try asking a teammate directly."

${contextSections.join('\n\n')}`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 800,
    system: systemPrompt,
    messages: [{ role: 'user', content: question }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]) as {
      answer?: string;
      primaryDoc?: { title?: string; section?: string; provider?: string; url?: string; description?: string } | null;
      contacts?: { name: string; email?: string; reason: string }[];
      documents?: { title?: string; section?: string; provider?: string; url?: string }[];
    };

    const mapDoc = (d: { title?: string; section?: string; provider?: string; url?: string; description?: string }): StructuredDocument => {
      const doc: StructuredDocument = {
        title: d.title ?? '',
        section: d.section ?? '',
      };
      if (d.provider) doc.provider = d.provider as StructuredDocument['provider'];
      if (d.url !== undefined) doc.url = d.url;
      if (d.description) (doc as any).description = d.description;
      return doc;
    };

    const primaryDoc = parsed.primaryDoc ? mapDoc(parsed.primaryDoc) : null;

    const documents: StructuredDocument[] = Array.isArray(parsed.documents)
      ? parsed.documents.map(mapDoc)
      : [];

    return {
      answer: parsed.answer || '',
      primaryDoc,
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      documents,
    };
  } catch {
    return null;
  }
}

export async function initVectorStore(): Promise<void> {
  // No-op: using Claude directly
}
