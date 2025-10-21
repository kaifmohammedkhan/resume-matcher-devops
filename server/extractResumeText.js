import fs from 'fs/promises';
import { parseWithMetadata } from './pdfParseWrapper.js'; // ✅ named import

export async function extractResumeText(filePath) {
  // Read file as Buffer asynchronously (non-blocking)
  const buffer = await fs.readFile(filePath);
  
  // Parse PDF text and metadata
  const { text = '', metadata = [] } = await parseWithMetadata(buffer);

  const highlighted = [];

  // Loop through metadata if available
  for (const item of metadata) {
    const { text: chunk, fontName, fontWeight } = item || {};

    const isBold =
      (fontWeight && fontWeight >= 600) ||
      (fontName && fontName.toLowerCase().includes('bold'));

    if (isBold && chunk && chunk.length > 2) {
      highlighted.push(chunk.trim());
    }
  }

  return {
    rawText: text,
    highlighted,
  };
}
