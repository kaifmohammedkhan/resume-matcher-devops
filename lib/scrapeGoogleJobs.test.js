import { jest } from '@jest/globals';

const mockAxiosGet = jest.fn();

jest.unstable_mockModule('axios', () => ({
  default: {
    get: mockAxiosGet,
  },
  get: mockAxiosGet,
}));

const { scrapeGoogleJobs } = await import('./scrapeGoogleJobs.js');

describe('scrapeGoogleJobs', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env = {
      ...originalEnv,
      GOOGLE_API_KEY: 'key1,key2,key3',
      WIREMOCK_URL: '',
      MOCK_SERP: '',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ============================================================
  // Existing coverage
  // ============================================================

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

  // ============================================================
  // Additional coverage - getKeywords()
  // ============================================================

  it('should return empty array when input is falsy', async () => {
    const result = await scrapeGoogleJobs(null);

    expect(result).toEqual([]);
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  it('should handle an array query and join keywords with OR', async () => {
    mockAxiosGet.mockResolvedValueOnce({
      status: 200,
      data: {
        jobs_results: [],
      },
    });

    const result = await scrapeGoogleJobs(
      ['React', 'Node.js'],
      'Bangalore'
    );

    expect(result).toEqual([]);
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);

    const requestedUrl = mockAxiosGet.mock.calls[0][0];

    expect(requestedUrl).toContain('React');
    expect(requestedUrl).toContain('Node.js');
    expect(requestedUrl).toContain('Bangalore');
  });

  it('should handle a primitive string input', async () => {
    mockAxiosGet.mockResolvedValueOnce({
      status: 200,
      data: {
        jobs_results: [],
      },
    });

    const result = await scrapeGoogleJobs(
      'React OR Node.js',
      'Bangalore'
    );

    expect(result).toEqual([]);
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);

    const requestedUrl = mockAxiosGet.mock.calls[0][0];

    expect(requestedUrl).toContain('React');
    expect(requestedUrl).toContain('Node.js');
  });

  it('should return empty array when object query is empty', async () => {
    const result = await scrapeGoogleJobs({
      query: '',
      location: 'Bangalore',
    });

    expect(result).toEqual([]);
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  // ============================================================
  // Additional coverage - parseJobItem() fallbacks
  // ============================================================

  it('should use fallback values when optional job fields are missing', async () => {
    mockAxiosGet.mockResolvedValueOnce({
      status: 200,
      data: {
        jobs_results: [
          {
            detected_extensions: {
              work_from_home: false,
            },
          },
        ],
      },
    });

    const result = await scrapeGoogleJobs({
      query: 'Developer',
      location: '',
    });

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      title: 'Untitled Role',
      company: 'Unknown Company',
      description: undefined,
      location: 'Global',
      job_apply_link: '#',
      url: '#',
      job_description: '',
      work_mode: 'Onsite',
      job_country: 'Global',
      source: 'SerpAPI',
    });
  });

  it('should use input location when job location is missing', async () => {
    mockAxiosGet.mockResolvedValueOnce({
      status: 200,
      data: {
        jobs_results: [
          {
            title: 'Developer',
            company_name: 'Example Corp',
            description: 'Developer role',
            link: 'https://example.com/job',
          },
        ],
      },
    });

    const result = await scrapeGoogleJobs({
      query: 'Developer',
      location: 'Bangalore',
    });

    expect(result[0]).toMatchObject({
      location: 'Bangalore',
      job_apply_link: 'https://example.com/job',
      url: 'https://example.com/job',
    });
  });

  it('should classify India locations as India', async () => {
    mockAxiosGet.mockResolvedValueOnce({
      status: 200,
      data: {
        jobs_results: [
          {
            title: 'Software Engineer',
            company_name: 'India Tech',
            location: 'Bangalore, India',
            description: 'Software engineering role',
            link: 'https://example.com/india-job',
          },
        ],
      },
    });

    const result = await scrapeGoogleJobs({
      query: 'Software Engineer',
      location: 'Bangalore',
    });

    expect(result[0].job_country).toBe('India');
  });

  it('should use the first apply option link when available', async () => {
    mockAxiosGet.mockResolvedValueOnce({
      status: 200,
      data: {
        jobs_results: [
          {
            title: 'Engineer',
            company_name: 'Tech Corp',
            location: 'Mumbai',
            description: 'Engineer role',
            link: 'https://example.com/job',
            apply_options: [
              {
                link: 'https://example.com/apply',
              },
            ],
          },
        ],
      },
    });

    const result = await scrapeGoogleJobs({
      query: 'Engineer',
      location: 'Mumbai',
    });

    expect(result[0].job_apply_link).toBe(
      'https://example.com/apply'
    );
    expect(result[0].url).toBe(
      'https://example.com/job'
    );
  });

  // ============================================================
  // Additional coverage - empty SerpAPI results
  // ============================================================

  it('should stop pagination when SerpAPI returns no jobs', async () => {
    mockAxiosGet.mockResolvedValueOnce({
      status: 200,
      data: {
        jobs_results: [],
      },
    });

    const result = await scrapeGoogleJobs({
      query: 'Python',
      location: 'Delhi',
    });

    expect(result).toEqual([]);
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
  });

  // ============================================================
  // Additional coverage - non-429 API error
  // ============================================================

  it('should stop key rotation on a non-429 API error', async () => {
    process.env.GOOGLE_API_KEY = 'key1,key2,key3';

    mockAxiosGet.mockRejectedValueOnce({
      response: {
        status: 500,
      },
    });

    const result = await scrapeGoogleJobs({
      query: 'Java',
      location: 'Pune',
    });

    expect(result).toEqual([]);
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
  });

  it('should return empty array when all API keys return 429', async () => {
    process.env.GOOGLE_API_KEY = 'key1,key2,key3';

    mockAxiosGet
      .mockRejectedValueOnce({
        response: {
          status: 429,
        },
      })
      .mockRejectedValueOnce({
        response: {
          status: 429,
        },
      })
      .mockRejectedValueOnce({
        response: {
          status: 429,
        },
      });

    const result = await scrapeGoogleJobs({
      query: 'DevOps',
      location: 'Mumbai',
    });

    expect(result).toEqual([]);
    expect(mockAxiosGet).toHaveBeenCalledTimes(3);
  });

  // ============================================================
  // Additional coverage - WireMock mode
  // ============================================================

  it('should use WireMock mode when WIREMOCK_URL is configured', async () => {
    process.env.WIREMOCK_URL = 'http://127.0.0.1:8080';

    mockAxiosGet.mockResolvedValueOnce({
      data: {
        results: [
          {
            title: 'Remote Engineer',
            work_mode: 'Remote',
          },
          {
            title: 'Onsite Engineer',
            work_mode: 'Onsite',
          },
        ],
      },
    });

    const result = await scrapeGoogleJobs({
      query: 'Engineer',
      location: 'Bangalore',
      workMode: 'Remote',
    });

    expect(mockAxiosGet).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/search'
    );

    expect(result).toEqual([
      {
        title: 'Remote Engineer',
        work_mode: 'Remote',
      },
    ]);
  });

  it('should return all WireMock jobs when workMode is All', async () => {
    process.env.WIREMOCK_URL = 'http://127.0.0.1:8080';

    mockAxiosGet.mockResolvedValueOnce({
      data: {
        results: [
          {
            title: 'Remote Engineer',
            work_mode: 'Remote',
          },
          {
            title: 'Onsite Engineer',
            work_mode: 'Onsite',
          },
        ],
      },
    });

    const result = await scrapeGoogleJobs({
      query: 'Engineer',
      workMode: 'All',
    });

    expect(result).toHaveLength(2);
  });

  it('should return empty array when WireMock request fails', async () => {
    process.env.WIREMOCK_URL = 'http://127.0.0.1:8080';

    mockAxiosGet.mockRejectedValueOnce(
      new Error('WireMock unavailable')
    );

    const result = await scrapeGoogleJobs({
      query: 'Engineer',
    });

    expect(result).toEqual([]);
  });

  it('should handle WireMock jobs without work_mode', async () => {
    process.env.WIREMOCK_URL = 'http://127.0.0.1:8080';

    mockAxiosGet.mockResolvedValueOnce({
      data: {
        results: [
          {
            title: 'Unknown Mode Job',
          },
        ],
      },
    });

    const result = await scrapeGoogleJobs({
      query: 'Engineer',
      workMode: 'Remote',
    });

    expect(result).toEqual([]);
  });

  // ============================================================
  // Additional coverage - Legacy MOCK_SERP mode
  // ============================================================

  it('should return legacy mock jobs when MOCK_SERP is enabled', async () => {
    process.env.MOCK_SERP = 'true';

    const result = await scrapeGoogleJobs({
      query: 'Developer',
      location: 'Bangalore',
      workMode: 'All',
    });

    expect(result).toHaveLength(2);

    expect(result[0]).toMatchObject({
      title: 'Software Engineer (Mock)',
      company: 'DevOps Labs',
      location: 'Bangalore',
      work_mode: 'Remote',
      source: 'Mock',
    });

    expect(result[1]).toMatchObject({
      title: 'Full Stack Developer (Mock)',
      company: 'Cloud Solutions Inc',
      location: 'Bangalore',
      work_mode: 'Onsite',
      source: 'Mock',
    });

    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  it('should filter legacy mock jobs by work mode', async () => {
    process.env.MOCK_SERP = 'true';

    const result = await scrapeGoogleJobs({
      query: 'Developer',
      location: 'Bangalore',
      workMode: 'Remote',
    });

    expect(result).toHaveLength(1);
    expect(result[0].work_mode).toBe('Remote');
  });
});