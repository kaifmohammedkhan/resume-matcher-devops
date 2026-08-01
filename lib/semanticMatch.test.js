import { jest } from '@jest/globals';

// 1. Mock the embedding dependency BEFORE importing the module
jest.unstable_mockModule('./embedText.js', () => ({
  embedText: jest.fn()
}));

// 2. Import dependencies
const { embedText } = await import('./embedText.js');
const { scoreJobs } = await import('./semanticMatch.js');

describe('semanticMatch - scoreJobs', () => {
  const mockResume = "Full-stack developer experienced in React and Node.js.";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should rank a relevant job higher than an irrelevant one', async () => {
    // Mock embeddings: [1, 0] for Resume, [1, 0.1] for Match, [0, 1] for Non-match
    embedText
      .mockResolvedValueOnce([1, 0])   // Resume
      .mockResolvedValueOnce([1, 0.1]) // Job 1 (Relevant)
      .mockResolvedValueOnce([0, 1]);  // Job 2 (Irrelevant)

    const jobs = [
      { title: "React Dev", job_description: "Building modern UI with React and Node.js for scale." },
      { title: "Chef", job_description: "Looking for an experienced chef to manage a busy Italian kitchen." }
    ];

    const result = await scoreJobs(mockResume, jobs);

    expect(result[0].title).toBe("React Dev");
    expect(result[0].matchScore).toBeGreaterThan(result[1].matchScore);
    expect(embedText).toHaveBeenCalledTimes(3);
  });

  it('should assign a score of 0 to "weak" job listings (< 50 chars)', async () => {
    embedText.mockResolvedValue([1, 1]); // Resume

    const jobs = [
      { title: "Short Job", job_description: "Too short." } // Length < 50
    ];

    const result = await scoreJobs(mockResume, jobs);

    expect(result[0].matchScore).toBe(0);
    // embedText should only be called for the resume, not the weak job
    expect(embedText).toHaveBeenCalledTimes(1);
  });

  it('should handle empty or missing job titles/descriptions gracefully', async () => {
    embedText.mockResolvedValue([1, 1]);

    const jobs = [
      { title: null, job_description: null }
    ];

    const result = await scoreJobs(mockResume, jobs);
    expect(result[0].matchScore).toBe(0);
  });

  it('should sort the results in descending order of matchScore', async () => {
    // Vectors chosen so CosineSimilarity(Resume, High) > CosineSimilarity(Resume, Mid)
    // Resume = [1, 0]
    // Mid    = [0.6, 0.8] -> Similarity = 0.6
    // High   = [0.95, 0.31] -> Similarity = 0.95
    embedText
      .mockResolvedValueOnce([1, 0])     // Resume
      .mockResolvedValueOnce([0.6, 0.8]) // Mid match
      .mockResolvedValueOnce([0.95, 0.31]); // High match

    const jobs = [
      { title: "Mid", job_description: "A mid-level description that is definitely over fifty characters long." },
      { title: "High", job_description: "A high-level description that is definitely over fifty characters long." }
    ];

    const result = await scoreJobs(mockResume, jobs);

    expect(result[0].title).toBe("High");
    expect(result[1].title).toBe("Mid");
    expect(result[0].matchScore).toBeGreaterThan(result[1].matchScore);
  });
});