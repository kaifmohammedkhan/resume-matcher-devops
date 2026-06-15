import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Modern PDF extraction using Mozilla's official engine.
 * Handles 'Function 21' and complex encodings that crash pdf-parse.
 */
export async function parseWithMetadata(buffer) {
  try {
    // 1. Initialize the document
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true, // Crucial: skips the broken font-rendering logic
    });

    const pdfDocument = await loadingTask.promise;
    let fullText = "";

    // 2. Loop through all pages to grab raw text
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      
      // 3. Join strings with spaces to ensure keywords are preserved for the matcher
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + "\n";
    }

    return {
      text: fullText,
      metadata: [] // Keeps compatibility with your extractResumeText.js
    };
  } catch (err) {
    console.error("❌ Modern PDF Parse Failure:", err.message);
    // Final fallback: return the raw buffer as a sanitized string if the engine fails
    return {
      text: buffer.toString('utf8').replace(/[^\x20-\x7E\n]/g, ' '),
      metadata: []
    };
  }
}