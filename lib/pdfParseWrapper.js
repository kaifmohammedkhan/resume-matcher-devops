import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse'); // works for pdf-parse@1.1.1

export async function parseWithMetadata(buffer) {
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    metadata: [],
  };
}
