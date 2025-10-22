import stopwords from './stopwords.js';

export function extractFrequentKeywords(text, minCount = 5) {
  const wordCounts = {};
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (const word of tokens) {
    if (stopwords.has(word)) continue;
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  }

  return Object.entries(wordCounts)
    .filter(([_, count]) => count >= minCount)
    .map(([word]) => word);
}
