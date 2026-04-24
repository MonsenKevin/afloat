import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import Anthropic from '@anthropic-ai/sdk';
import { KBAnswer } from '../types/index';

// Claude for answer synthesis; OpenAI for embeddings (Claude has no embeddings API)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-3-5-haiku-20241022';

let vectorStore: MemoryVectorStore | null = null;

export async function initVectorStore(docs: Document[]): Promise<void> {
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 50 });
  const chunks = await splitter.splitDocuments(docs);
  vectorStore = await MemoryVectorStore.fromDocuments(
    chunks,
    new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY })
  );
  console.log(`Vector store initialized with ${chunks.length} chunks from ${docs.length} documents.`);
}

export async function queryKB(question: string): Promise<KBAnswer[]> {
  if (!vectorStore) {
    return [];
  }

  const results = await vectorStore.similaritySearchWithScore(question, 3);
  if (!results.length || results[0][1] < 0.3) {
    return [];
  }

  const context = results.map(([doc]) => {
    const title = (doc.metadata?.title as string) || 'Knowledge Base';
    const section = (doc.metadata?.section as string) || '';
    return `[${title}${section ? ' > ' + section : ''}]\n${doc.pageContent}`;
  }).join('\n\n');

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `Answer the question using only the provided context. Return ONLY valid JSON with no markdown:
{ "answer": string | null, "citation": "<doc title> > <section>" }
If you cannot answer from the context, set answer to null and citation to "".
Context:\n${context}`,
    messages: [
      { role: 'user', content: question }
    ]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(cleaned) as { answer: string | null; citation: string };

  if (!parsed.answer) return [];
  return [{ answer: parsed.answer, citation: parsed.citation || 'Knowledge Base', confidence: results[0][1] }];
}
