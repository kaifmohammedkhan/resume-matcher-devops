import fs from 'fs/promises';
import path from 'path';
import { parseWithMetadata } from './pdfParseWrapper.js'; // ✅ named import
import nlp from 'compromise';

export async function extractResumeText(input) {
  try {
    let buffer;

    if (Buffer.isBuffer(input)) {
      buffer = input; // ✅ Vercel-safe
    } else if (typeof input === 'string') {
      const resolvedPath = path.resolve(input); // ✅ Local dev
      await fs.access(resolvedPath);
      buffer = await fs.readFile(resolvedPath);
    } else {
      throw new Error('Invalid resume input: must be Buffer or file path');
    }

    const { text = '', metadata = [] } = await parseWithMetadata(buffer);

    // ✅ Extract bold highlights
    const highlighted = [];
    for (const item of metadata) {
      const { text: chunk, fontName, fontWeight } = item || {};
      const isBold =
        (fontWeight && fontWeight >= 600) ||
        (fontName && fontName.toLowerCase().includes('bold'));

      if (isBold && chunk && chunk.length > 2) {
        highlighted.push(chunk.trim());
      }
    }

    // ✅ Extract email
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch?.[0] || 'unknown@example.com';

    // ✅ Derive name hints from email
    const emailLocal = email.split('@')[0]; // e.g. "mahajansuprita"
    const nameParts = emailLocal.split(/[._\-]/).filter(p => p.length > 2); // ['mahajansuprita']

    // ✅ Try matching name from resume using email hints
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let name = 'Unknown';

    for (const line of lines) {
      for (const part of nameParts) {
        if (
          line.toLowerCase().includes(part.toLowerCase()) &&
          /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*$/.test(line)
        ) {
          name = line;
          break;
        }
      }
      if (name !== 'Unknown') break;
    }

    // ✅ Fallback to NLP if no match
    if (name === 'Unknown') {
      const doc = nlp(text);
      const people = doc.people().json();
      if (people.length > 0) {
        name = people[0].text;
      } else {
        // Fallback: first line heuristic
        const firstLine = lines[0];
        if (/^[A-Z][a-z]+(?:\s[A-Z][a-z]+)+$/.test(firstLine)) {
          name = firstLine;
        }
      }
    }

    return {
      rawText: text,
      highlighted,
      name: name.trim(),
      email
    };
  } catch (err) {
    console.error(`❌ Resume parse failed:`, err.message);
    throw new Error(`Resume parse failed: ${err.message}`);
  }
}
