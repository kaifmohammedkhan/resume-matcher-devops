import { buildOrQuery } from './buildOrQuery.js';

describe('buildOrQuery', () => {
  it('should join keywords with OR', () => {
    const result = buildOrQuery(['react', 'node']);
    expect(result).toBe('"react" OR "node"');
  });

  it('should handle empty array', () => {
    const result = buildOrQuery([]);
    expect(result).toBe('');
  });
});
