import Anthropic from '@anthropic-ai/sdk';
import { CultureValue, ClassificationResult } from '../types/index';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Claude model to use for all chat/classification calls
const MODEL = 'claude-3-5-haiku-20241022';

/**
 * Parse JSON from Claude's response, stripping any markdown code fences.
 */
function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned) as T;
}

export async function generateCheckInQuestions(cultureValues: CultureValue[]): Promise<string[]> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `You are Mission_Control, a calm and intelligent onboarding co-pilot.
Generate a biweekly check-in for a new employee. Return ONLY valid JSON with no markdown: { "questions": string[] }
Generate exactly 5 questions. Cover: (1) connection to specific culture values, (2) team belonging, (3) technical progress.
Culture values: ${JSON.stringify(cultureValues.map(v => v.name))}`,
    messages: [
      { role: 'user', content: "Generate this sprint's check-in questions." }
    ]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = parseJson<{ questions: string[] }>(text);
  return parsed.questions;
}

export async function classifyCheckIn(
  questions: string[],
  responses: string[],
  cultureValues: CultureValue[]
): Promise<ClassificationResult> {
  const qa = questions.map((q, i) => `Q: ${q}\nA: ${responses[i] || '(no response)'}`).join('\n\n');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `You are an onboarding analyst. Analyze check-in responses and return ONLY valid JSON with no markdown:
{
  "sentimentScore": <1-5 float>,
  "struggleType": "HUMAN" | "TECHNICAL" | "BOTH" | "NONE",
  "implicatedValues": [<culture value names>],
  "summary": "<one sentence>"
}
HUMAN = cultural/relational friction. TECHNICAL = deliverable/code friction. NONE = no significant friction.
sentimentScore: 1=very disengaged, 3=neutral, 5=very engaged.
Culture values: ${JSON.stringify(cultureValues.map(v => v.name))}`,
    messages: [
      { role: 'user', content: qa }
    ]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = parseJson<ClassificationResult>(text);

  // Clamp sentiment score to [1, 5]
  parsed.sentimentScore = Math.min(5, Math.max(1, Number(parsed.sentimentScore)));
  return parsed;
}
