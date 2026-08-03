import stopwords from './stopwords.js';

describe('stopwords', () => {
  it('should contain common stopwords', () => {
    expect(stopwords.has('the')).toBe(true);
    expect(stopwords.has('and')).toBe(true);
    expect(stopwords.has('resume')).toBe(true);
  });

  it('should not contain non-stopwords', () => {
    expect(stopwords.has('react')).toBe(false);
    expect(stopwords.has('node')).toBe(false);
    expect(stopwords.has('developer')).toBe(false);
  });

  it('should be a Set instance', () => {
    expect(stopwords instanceof Set).toBe(true);
  });
});
