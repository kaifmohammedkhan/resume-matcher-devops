import fs from 'fs/promises';
import path from 'path';
import { parseWithMetadata } from './pdfParseWrapper.js';

/**
 * Extracts raw text and highlighted (bold) terms from a resume.
 * Optimized for Node 22 and Formidable v3 file paths.
 */
export async function extractResumeText(input) {
  try {
    let buffer;

    // 1. Resolve Input to Buffer
    if (Buffer.isBuffer(input)) {
      buffer = input;
    } else if (typeof input === 'string') {
      const resolvedPath = path.isAbsolute(input) ? input : path.resolve(process.cwd(), input);
      buffer = await fs.readFile(resolvedPath);
    } else {
      throw new Error('Invalid resume input: must be Buffer or file path');
    }

    // 2. Parse Content
    const result = await parseWithMetadata(buffer);
    const rawText = result?.text || '';

    // 3. Fallback for empty results
    if (!rawText.trim()) {
      console.warn("⚠️ PDF Engine returned empty. Attempting raw binary scrape...");
      return {
        rawText: buffer.toString('binary').replace(/[^\x20-\x7E\n]/g, ' '),
        highlighted: []
      };
    }

    // 4. Extract "Highlighted" terms
    const metadata = result?.metadata || [];
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
    // ✅ FIX: Wrap the error message to match the expected test assertion
    // This resolves: Expected substring: "Resume parse failed: Parser Failure"
    const wrappedError = new Error(`Resume parse failed: ${err.message}`);
    console.error(`❌ Extraction logic failed:`, wrappedError.message);
    throw wrappedError;
  }
}