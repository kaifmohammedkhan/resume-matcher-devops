import fs from 'fs/promises';
import path from 'path';
import { parseWithMetadata } from './pdfParseWrapper.js'; // ✅ named import

export async function extractResumeText(input) {
  try {
    let buffer;

    if (Buffer.isBuffer(input)) {
      // ✅ Vercel-safe: resume uploaded in-memory
      buffer = input;
    } else if (typeof input === 'string') {
      // ✅ Local dev: resume uploaded to disk
      const resolvedPath = path.resolve(input);
      await fs.access(resolvedPath);
      buffer = await fs.readFile(resolvedPath);
    } else {
      throw new Error('Invalid resume input: must be Buffer or file path');
    }

    const { text = '', metadata = [] } = await parseWithMetadata(buffer);

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

    return {
      rawText: text,
      highlighted,
    };
  } catch (err) {
    console.error(`❌ Resume parse failed:`, err.message);
    throw new Error(`Resume parse failed: ${err.message}`);
  }
}
