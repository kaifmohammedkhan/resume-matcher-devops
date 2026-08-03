import { jest } from '@jest/globals';

const mockExtractResumeText = jest.fn();
const mockExtractSmartKeywords = jest.fn();
const mockScrapeGoogleJobs = jest.fn();

jest.unstable_mockModule('./extractResumeText.js', () => ({
  extractResumeText: mockExtractResumeText,
}));
jest.unstable_mockModule('./extractSmartKeywords.js', () => ({
  extractSmartKeywords: mockExtractSmartKeywords,
}));
jest.unstable_mockModule('./scrapeGoogleJobs.js', () => ({
  scrapeGoogleJobs: mockScrapeGoogleJobs,
}));

// ✅ Updated to import resumeHandler.js
const { handleResumeUpload } = await import('./resumeHandler.js');

describe('handleResumeUpload (alt)', () => {
  it('should return jobs', async () => {
    mockExtractResumeText.mockResolvedValue('resume text');
    mockExtractSmartKeywords.mockReturnValue(['react']);
    mockScrapeGoogleJobs.mockResolvedValue([{ title: 'Job1' }]);

    const result = await handleResumeUpload('resume.pdf', 'NYC', 'Remote');
    expect(result).toEqual([{ title: 'Job1' }]);
  });
});