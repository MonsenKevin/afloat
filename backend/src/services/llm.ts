import Anthropic from '@anthropic-ai/sdk';
import { CultureValue, ClassificationResult } from '../types/index';

const MODEL = 'claude-haiku-4-5-20251001';

// Lazy client — created on first use so dotenv has already run
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

function parseJson<T>(text: string): T {
  // Extract the first JSON object/array — handles markdown fences and extra text
  const match = text.match(/[\[{][\s\S]*[\]}]/);
  if (!match) throw new Error(`No JSON found in response: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]) as T;
}

export async function generateCheckInQuestions(cultureValues: CultureValue[]): Promise<string[]> {
  const sliders = cultureValues.map(v => `slider:${v.name}`);
  return [
    ...sliders,
    'text:What technical work are you focused on this sprint, and where are you blocked?',
    'text:How connected do you feel to your team and company culture right now?',
  ];
}

export async function classifyCheckIn(
  questions: string[],
  responses: string[],
  cultureValues: CultureValue[]
): Promise<ClassificationResult> {
  const lines: string[] = [];
  questions.forEach((q, i) => {
    const resp = responses[i] || '(no response)';
    if (q.startsWith('slider:')) {
      lines.push(`Culture value "${q.slice(7)}": rated ${resp}/5`);
    } else if (q.startsWith('text:')) {
      lines.push(`Q: ${q.slice(5)}\nA: ${resp}`);
    } else {
      lines.push(`Q: ${q}\nA: ${resp}`);
    }
  });

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `You are an onboarding analyst. Analyze check-in responses and return ONLY valid JSON with no markdown:
{
  "sentimentScore": <1-5 float>,
  "struggleType": "HUMAN" | "TECHNICAL" | "BOTH" | "NONE",
  "implicatedValues": [<culture value names>],
  "summary": "<one sentence>"
}
HUMAN = cultural/relational friction. TECHNICAL = deliverable/code friction. NONE = no friction.
sentimentScore: average of slider ratings adjusted by text sentiment. 1=very disengaged, 5=very engaged.
Culture values: ${JSON.stringify(cultureValues.map(v => v.name))}`,
    messages: [{ role: 'user', content: lines.join('\n\n') }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = parseJson<ClassificationResult>(text);
  parsed.sentimentScore = Math.min(5, Math.max(1, Number(parsed.sentimentScore)));
  return parsed;
}
