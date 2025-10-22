// server/embedText.js
import { pipeline } from '@xenova/transformers';

let embedder;

export async function embedText(text) {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  const output = await embedder(text, {
    pooling: 'mean',
    normalize: true
  });

  const vector = output.data;

  // Debug: log first few values
  console.log('🧠 Embedding sample:', vector.slice(0, 5));
  console.log('📏 Embedding length:', vector.length);

  return vector;
}
