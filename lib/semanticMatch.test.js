import { jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';

const mockEmbedText = jest.fn();

jest.unstable_mockModule(
  fileURLToPath(new URL('./embedText.js', import.meta.url)),
  () => ({
    embedText: mockEmbedText,
    default: mockEmbedText,
  })
);

const { calculateSemanticSimilarity } = await import(
  fileURLToPath(new URL('./semanticMatch.js', import.meta.url))
);

describe('calculateSemanticSimilarity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should calculate cosine similarity between two text strings', async () => {
    mockEmbedText
      .mockResolvedValueOnce([1, 0, 0])
      .mockResolvedValueOnce([1, 0, 0]);

    const score = await calculateSemanticSimilarity('resume text', 'job text');
    expect(score).toBe(1);
    expect(mockEmbedText).toHaveBeenCalledTimes(2);
  });
});