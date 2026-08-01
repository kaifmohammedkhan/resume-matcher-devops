import { jest } from '@jest/globals';

// Define the mock get function
const mockAxiosGet = jest.fn();

// Mock axios before loading module under test
jest.unstable_mockModule('axios', () => ({
  default: {
    get: mockAxiosGet,
  },
  get: mockAxiosGet,
}));

// Dynamic import after mocks
const { scrapeGoogleJobs } = await import('./scrapeGoogleJobs.js');

describe('scrapeGoogleJobs', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env = {
      ...originalEnv,
      GOOGLE_API_KEY: 'key1,key2,key3',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return empty array if API keys are missing', async () => {
    process.env.GOOGLE_API_KEY = '';

    const result = await scrapeGoogleJobs({
      query: 'React',
      location: 'Bangalore',
    });

    expect(result).toEqual([]);
  });

  it('should parse keywords and return jobs', async () => {
    mockAxiosGet.mockResolvedValueOnce({
      status: 200,
      data: {
        jobs_results: [
          {
            title: 'Senior React Developer',
            company_name: 'TechCorp',
            location: 'Bangalore',
            description:
              'TechCorp is looking for a React developer in Bangalore.',
            link: 'https://www.linkedin.com/jobs/view/1234567890',
            detected_extensions: {
              work_from_home: true,
            },
            apply_options: [
              {
                link: 'https://www.linkedin.com/jobs/view/1234567890',
              },
            ],
          },
        ],
      },
    });

    const result = await scrapeGoogleJobs({
      query: 'React',
      location: 'Bangalore',
      workMode: 'Remote',
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      title: 'Senior React Developer',
      company: 'TechCorp',
      location: 'Bangalore',
      work_mode: 'Remote',
      source: 'SerpAPI',
      job_apply_link: 'https://www.linkedin.com/jobs/view/1234567890',
    });
  });

  it('should rotate keys on 429 error', async () => {
    process.env.GOOGLE_API_KEY = 'key1,key2,key3,key4';

    mockAxiosGet
      .mockRejectedValueOnce({
        response: {
          status: 429,
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          jobs_results: [
            {
              title: 'DevOps Engineer',
              company_name: 'CloudSoft',
              location: 'Mumbai',
              description:
                'CloudSoft is hiring a DevOps engineer.',
              link: 'https://www.linkedin.com/jobs/view/9876543210',
              detected_extensions: {
                work_from_home: false,
              },
              apply_options: [
                {
                  link: 'https://www.linkedin.com/jobs/view/9876543210',
                },
              ],
            },
          ],
        },
      });

    const result = await scrapeGoogleJobs({
      query: 'DevOps',
      location: 'Mumbai',
    });

    expect(mockAxiosGet).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      title: 'DevOps Engineer',
      company: 'CloudSoft',
      location: 'Mumbai',
      work_mode: 'Onsite',
    });
  });

  it('should enforce query length limits', async () => {
    const longQuery = 'a'.repeat(5001);

    await expect(
      scrapeGoogleJobs({
        query: longQuery,
      })
    ).rejects.toThrow('Query too long');
  });
});