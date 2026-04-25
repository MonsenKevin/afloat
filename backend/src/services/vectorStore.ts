import Anthropic from '@anthropic-ai/sdk';
import { getKbDocuments } from './kbLoader';

const MODEL = 'claude-haiku-4-5-20251001';

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
  contacts: { name: string; email?: string; reason: string }[];
  documents: { title: string; section: string }[];
}

export async function queryKB(
  question: string,
  checkinContext?: string | null,
  conversationHistory?: string | null,
  isManager?: boolean
): Promise<StructuredAnswer | null> {
  const docs = getKbDocuments();

  const kbContext = docs.length > 0
    ? docs.map(d => `[${d.title} > ${d.section}]\n${d.content}`).join('\n\n---\n\n')
    : null;

  const contextSections: string[] = [];
  if (kbContext) contextSections.push(`KNOWLEDGE BASE:\n${kbContext}`);
  if (checkinContext) contextSections.push(isManager ? `TEAM CHECK-IN DATA:\n${checkinContext}` : `YOUR RECENT CHECK-INS:\n${checkinContext}`);
  if (conversationHistory) contextSections.push(`RECENT CONVERSATION:\n${conversationHistory}`);

  const roleInstruction = isManager
    ? 'You are speaking with a MANAGER. Give team-level insights. Be specific about individuals when relevant. Be professional and constructive.'
    : 'You are speaking with a new employee. Give personalized, supportive guidance.';

  const systemPrompt = `You are Mission Control, an AI onboarding co-pilot. ${roleInstruction}

Return ONLY valid JSON in this exact shape:
{
  "answer": "<main answer text, 1-4 sentences, no markdown>",
  "contacts": [
    { "name": "<full name>", "email": "<email if known>", "reason": "<why to contact them, 1 sentence>" }
  ],
  "documents": [
    { "title": "<document title>", "section": "<section name>" }
  ]
}

Rules:
- "answer" must be plain text, no bullet points, no markdown
- "contacts" should only include people explicitly mentioned in the context — leave empty array [] if none relevant
- "documents" should list any KB documents you drew from — leave empty array [] if none used
- If you cannot answer, set answer to "I don't have enough information to answer that. Try asking a teammate."

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
    const parsed = JSON.parse(match[0]) as StructuredAnswer;
    return {
      answer: parsed.answer || '',
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
    };
  } catch {
    return null;
  }
}

export async function initVectorStore(): Promise<void> {
  // No-op: using Claude directly
}
