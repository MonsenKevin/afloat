import fs from 'fs';
import path from 'path';
import { Document } from 'langchain/document';

export function loadKbDocuments(): Document[] {
  const kbDir = path.join(__dirname, '../../data/kb');
  if (!fs.existsSync(kbDir)) {
    console.warn('KB directory not found:', kbDir);
    return [];
  }
  const files = fs.readdirSync(kbDir).filter(f => f.endsWith('.md'));
  const docs: Document[] = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(kbDir, file), 'utf-8');
    const title = file.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    // Split by ## headings to create section-level documents
    const sections = content.split(/^## /m);
    for (const section of sections) {
      if (!section.trim()) continue;
      const lines = section.split('\n');
      const sectionTitle = lines[0].trim();
      const sectionContent = lines.slice(1).join('\n').trim();
      if (sectionContent.length < 50) continue;
      docs.push(new Document({
        pageContent: `## ${sectionTitle}\n${sectionContent}`,
        metadata: { title, section: sectionTitle, source: file }
      }));
    }
  }
  return docs;
}
