import { jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';

const mockExtractResumeText = jest.fn();
const mockExtractSmartKeywords = jest.fn();

jest.unstable_mockModule(
  fileURLToPath(new URL('./extractResumeText.js', import.meta.url)),
  () => ({
    extractResumeText: mockExtractResumeText,
    default: mockExtractResumeText,
  })
);

jest.unstable_mockModule(
  fileURLToPath(new URL('./extractSmartKeywords.js', import.meta.url)),
  () => ({
    extractSmartKeywords: mockExtractSmartKeywords,
    default: mockExtractSmartKeywords,
  })
);

const { handleResumeUpload } = await import(
  fileURLToPath(new URL('./resumeHandler.js', import.meta.url))
);

describe('resumeHandler handler', () => {
  let req, res;

  beforeEach(() => {
    req = { file: { path: 'test.pdf' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('should extract text and return keywords', async () => {
    mockExtractResumeText.mockResolvedValue('sample resume content');
    mockExtractSmartKeywords.mockReturnValue(['javascript', 'docker']);

    await handleResumeUpload(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: ['javascript', 'docker'],
      })
    );
  });
});