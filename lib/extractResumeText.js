import fs from 'node:fs/promises';
import path from 'node:path';
import { parseWithMetadata } from './pdfParseWrapper.js';

const SAFE_ROOT = path.resolve(process.cwd(), 'uploads/resumes');

/**
 * Extracts raw text and highlighted (bold) terms from a resume.
 * Hardened against path traversal and unsafe encodings.
 */
export async function extractResumeText(input) {
  try {
    let buffer;

    // 1. Resolve Input to Buffer
    if (Buffer.isBuffer(input)) {
      buffer = input;
    } else if (typeof input === 'string') {
      const resolvedPath = path.resolve(SAFE_ROOT, input);

      // Path restriction: must stay inside SAFE_ROOT
      if (!resolvedPath.startsWith(SAFE_ROOT)) {
        throw new Error('Invalid path: outside of resumes directory');
      }

      buffer = await fs.readFile(resolvedPath);
    } else {
      throw new Error('Invalid resume input: must be Buffer or file path');
    }

    // 2. Parse Content
    const result = await parseWithMetadata(buffer);
    const rawText = result?.text || '';

    // 3. Fallback for empty results
    if (!rawText.trim()) {
      console.warn("⚠️ PDF Engine returned empty. Attempting raw UTF-8 scrape...");
      return {
        rawText: buffer.toString('utf8').replace(/[^\p{L}\p{N}\p{P}\p{Z}\n]/gu, ' '),
        highlighted: []
      };
    }

    // 4. Extract "Highlighted" terms
    const metadata = Array.isArray(result?.metadata) ? result.metadata : [];
    const highlighted = metadata
      .filter(item => {
        const { text: chunk, fontName, fontWeight } = item || {};
        const isBold = (fontWeight && fontWeight >= 600) ||
                       (fontName && fontName.toLowerCase().includes('bold'));
        return isBold && chunk && chunk.trim().length > 2;
      })
      .map(item => item.text.trim());

    return {
      rawText,
      highlighted: [...new Set(highlighted)],
    };
  } catch (err) {
    const wrappedError = new Error(`Resume parse failed: ${err.message}`);
    console.error(`❌ Extraction logic failed:`, wrappedError.message);
    throw wrappedError;
  }
}
