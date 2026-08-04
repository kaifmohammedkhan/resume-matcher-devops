import { jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';

const mockExtractResumeText = jest.fn();
const mockExtractSmartKeywords = jest.fn();
const mockScrapeGoogleJobs = jest.fn();

jest.unstable_mockModule(fileURLToPath(new URL('../extractResumeText.js', import.meta.url)), () => ({
  extractResumeText: mockExtractResumeText,
}));
jest.unstable_mockModule(fileURLToPath(new URL('../extractSmartKeywords.js', import.meta.url)), () => ({
  extractSmartKeywords: mockExtractSmartKeywords,
}));
jest.unstable_mockModule(fileURLToPath(new URL('../scrapeGoogleJobs.js', import.meta.url)), () => ({
  scrapeGoogleJobs: mockScrapeGoogleJobs,
}));

const { handleResumeUpload } = await import('./resumeController.js');

describe('handleResumeUpload', () => {
  let req, res;

  beforeEach(() => {
    req = {
      file: { path: 'resume.pdf' },
      body: { location: 'NYC', workMode: 'Remote' },
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  it('should process resume and return keywords + jobs', async () => {
    mockExtractResumeText.mockResolvedValue('resume text');
    mockExtractSmartKeywords.mockReturnValue(['react', 'node']);
    mockScrapeGoogleJobs.mockResolvedValue([{ title: 'Job1' }]);

    await handleResumeUpload(req, res);

    expect(res.json).toHaveBeenCalledWith({
      keywords: ['react', 'node'],
      jobs: [{ title: 'Job1' }],
    });
  });

  it('should handle errors gracefully', async () => {
    mockExtractResumeText.mockRejectedValue(new Error('fail'));

    await handleResumeUpload(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Resume processing failed' });
  });
});