// server/extractSmartKeywords.js
import nlp from 'compromise';

export function extractSmartKeywords(text) {
  const doc = nlp(text);

  // Extract noun phrases and verbs
  const phrases = doc.nouns().concat(doc.verbs()).out('array');

  // Clean and filter (Fixed regex: removed unnecessary backslash before hyphen)
  const rawKeywords = phrases
    .map(p => p.toLowerCase().trim())
    .filter(p => p.length > 2 && /^[a-z\s-]+$/.test(p));

  // Score relevance based on frequency and context
  const scored = rawKeywords.map(k => {
    // Escape special regex chars in k before building dynamic RegExp
    const safeK = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const count = (text.match(new RegExp(`\\b${safeK}\\b`, 'gi')) || []).length;
    const contextBoost = /(used|built|led|implemented)\s+\b/.test(text) ? 2 : 1;
    return { keyword: k, score: count * contextBoost };
  });

  // Sort and select top 10
  const topKeywords = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(k => k.keyword);

  return [...new Set(topKeywords)];
}