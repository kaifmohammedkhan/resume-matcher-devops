import { jest } from '@jest/globals';

const mockNlp = jest.fn(() => ({
  nouns: () => ({ concat: () => ({ out: () => ['React', 'Node'] }) }),
  verbs: () => ({ out: () => [] }),
}));

jest.unstable_mockModule('compromise', () => ({
  default: mockNlp,
}));

const { extractSmartKeywords } = await import('./extractSmartKeywords.js');

describe('extractSmartKeywords', () => {
  it('should return top keywords', () => {
    const result = extractSmartKeywords('React developer used Node');
    expect(result).toContain('react');
    expect(result).toContain('node');
  });
});
