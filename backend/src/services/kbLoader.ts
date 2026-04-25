import fs from 'fs';
import path from 'path';

export interface KbDoc {
  title: string;
  section: string;
  content: string;
  source: string;
}

let kbDocs: KbDoc[] = [];

export function setKbDocuments(docs: KbDoc[]): void {
  kbDocs = docs;
}

export function getKbDocuments(): KbDoc[] {
  return kbDocs;
}

export function loadKbDocuments(): KbDoc[] {
  const kbDir = path.join(__dirname, '../../data/kb');
  if (!fs.existsSync(kbDir)) {
    console.warn('KB directory not found:', kbDir);
    return [];
  }

  const files = fs.readdirSync(kbDir).filter(f => f.endsWith('.md'));
  const docs: KbDoc[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(kbDir, file), 'utf-8');
    const title = file
      .replace('.md', '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    // Split by ## headings into sections
    const sections = content.split(/^## /m);
    for (const section of sections) {
      if (!section.trim()) continue;
      const lines = section.split('\n');
      const sectionTitle = lines[0].trim().replace(/^#+ /, '');
      const sectionContent = lines.slice(1).join('\n').trim();
      if (sectionContent.length < 30) continue;
      docs.push({ title, section: sectionTitle, content: sectionContent, source: file });
    }
  }

  return docs;
}
