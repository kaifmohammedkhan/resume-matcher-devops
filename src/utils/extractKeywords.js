export function extractKeywords(text) {
  const lowerText = text.toLowerCase();

  const normalizedText = lowerText
    .replace(/[\r\n]+/g, ' ')
    .replace(new RegExp('[_/-]', 'g'), ' ')
    .replace(/[.,;:!?(){}[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const rawWords = normalizedText.split(' ');

  const blacklist = new Set([
    'and', 'with', 'the', 'for', 'from', 'to', 'in', 'on', 'of',
    'skills', 'experience', 'summary', 'objective', 'responsibilities',
    'delivering', 'collaboration', 'get', 'done', 'my', 'your', 'our'
  ]);

  const keywords = [...new Set(
    rawWords
      .map(w => w.trim())
      .filter(w => w.length > 2 && !blacklist.has(w))
  )];

  const titles = keywords.filter(k =>
    /\b(engineer|developer|architect|analyst|manager|lead|consultant|specialist|officer|head|executive|recruiter|hrbp)\b/.test(k)
  );

  const education = keywords.filter(k =>
    /\b(bachelor|master|phd|mba|btech|mtech|degree|diploma|bsc|msc)\b/.test(k)
  );

  return {
    tech: keywords,
    titles,
    education
  };
}