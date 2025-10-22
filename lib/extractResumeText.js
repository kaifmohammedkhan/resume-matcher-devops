import fs from 'fs/promises';
import path from 'path';
import { parseWithMetadata } from './pdfParseWrapper.js'; // ✅ named import

export async function extractResumeText(filePath) {
  try {
    // Normalize and verify file path
    const resolvedPath = path.resolve(filePath);
    await fs.access(resolvedPath);

    // Read file as Buffer asynchronously (non-blocking)
    const buffer = await fs.readFile(resolvedPath);

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
  } catch (err) {
    console.error(`❌ Resume parse failed for ${filePath}:`, err.message);
    throw new Error(`Resume parse failed: ${err.message}`);
  }
}
