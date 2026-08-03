import { extractFrequentKeywords } from './extractFrequentKeywords.js';

describe('extractFrequentKeywords', () => {
  it('should extract frequent words', () => {
    const text = 'React React React Node Node Node Node Node';
    const result = extractFrequentKeywords(text, 5);
    expect(result).toContain('node');
    expect(result).not.toContain('react');
  });
});
