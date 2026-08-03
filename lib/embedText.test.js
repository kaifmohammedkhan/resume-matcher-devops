import { jest } from '@jest/globals';

const mockPipeline = jest.fn();
jest.unstable_mockModule('@xenova/transformers', () => ({
  pipeline: mockPipeline,
}));

const { embedText } = await import('./embedText.js');

describe('embedText', () => {
  it('should return vector from embedder', async () => {
    const fakeEmbedder = jest.fn().mockResolvedValue({ data: [0.1, 0.2, 0.3] });
    mockPipeline.mockResolvedValue(fakeEmbedder);

    const result = await embedText('hello world');
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });
});
