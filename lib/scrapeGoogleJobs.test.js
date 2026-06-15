import { jest } from '@jest/globals';

// 1. Mock axios BEFORE the module is loaded
jest.unstable_mockModule('axios', () => ({
  default: {
    get: jest.fn(),
  },
}));

// 2. Import dependencies
const { default: axios } = await import('axios');
const ScraperModule = await import('./scrapeGoogleJobs.js');

const scrapeGoogleJobs = ScraperModule.scrapeGoogleJobs || ScraperModule.default;

describe('scrapeGoogleJobs', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { 
      ...originalEnv, 
      GOOGLE_API_KEY: 'key1,key2', 
      GOOGLE_CX_ID: 'test-cx' 
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return empty array if API keys are missing', async () => {
    process.env.GOOGLE_API_KEY = '';
    const result = await scrapeGoogleJobs({ query: 'React', location: 'India' });
    expect(result).toEqual([]);
  });

  it('should parse keywords and return jobs', async () => {
    // ✅ FIX: Mock a valid LinkedIn Job View URL so the scraper doesn't filter it out
    axios.get.mockResolvedValue({
      data: {
        items: [{
          title: 'Frontend Developer at TechCorp',
          link: 'https://www.linkedin.com/jobs/view/12345', 
          snippet: 'Remote role at TechCorp. We need a React dev. This snippet is long enough to pass filters.',
        }]
      }
    });

    const result = await scrapeGoogleJobs({ query: 'React', location: 'Bangalore', workMode: 'Remote' });
    
    expect(result.length).toBeGreaterThan(0);
    // Company extraction regex looks for "at [Company]"
    expect(result[0].company).toBe('TechCorp');
  });

  it('should rotate keys on 429 error', async () => {
    // First call with Key 1 fails 429. Second call with Key 2 succeeds.
    axios.get
      .mockRejectedValueOnce({ response: { status: 429 } })
      .mockResolvedValueOnce({
        data: {
          items: [{
            title: 'DevOps at CloudSoft',
            link: 'https://www.linkedin.com/jobs/view/67890',
            snippet: 'Onsite Mumbai role at CloudSoft. Requires Kubernetes and AWS experience.'
          }]
        }
      });

    const result = await scrapeGoogleJobs({ query: ['DevOps'], location: 'Mumbai' });
    
    // Check that we actually got a result back after the rotation
    expect(axios.get).toHaveBeenCalledTimes(2); 
    expect(result[0].company).toBe('CloudSoft');
  });

  it('should enforce query length limits', async () => {
    const longQuery = 'a'.repeat(5001);
    // The scraper checks length on the combined string: query + site:linkedin... + location
    // So 5001 chars will definitely trigger the "Query too long" error.
    await expect(scrapeGoogleJobs({ query: longQuery }))
      .rejects.toThrow('Query too long');
  });
});