// server/buildOrQuery.js
export function buildOrQuery(keywords) {
  return keywords.map(k => `"${k}"`).join(' OR ');
}
