export function highlightKeywords(text, keywords) {
  // Escape regex metacharacters in each keyword
  const escapeRegex = (str) =>
    str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let highlighted = text;

  keywords.forEach((k) => {
    const safeKeyword = escapeRegex(k);
    const regex = new RegExp(`\\b(${safeKeyword})\\b`, 'gi');
    highlighted = highlighted.replace(
      regex,
      '<span class="bg-yellow-300 text-black font-semibold px-1 rounded-sm">$1</span>'
    );
  });

  return highlighted;
}
