import { jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';

let handler;

beforeAll(async () => {
  // Mock formidable to bypass real file parsing
  jest.unstable_mockModule('formidable', () => ({
    formidable: jest.fn(() => ({
      parse: jest.fn().mockResolvedValue([
        { location: ['Hyderabad'], workMode: ['Remote'] },
        {
          resume: [
            {
              originalFilename: 'resume.pdf',
              mimetype: 'application/pdf',
              _writeStream: { buffer: Buffer.from('fake') },
            },
          ],
        },
      ]),
    })),
  }));

  // Mock all lib modules used by handler
  jest.unstable_mockModule(
    fileURLToPath(new URL('../lib/extractResumeText.js', import.meta.url)),
    () => ({
      extractResumeText: jest.fn().mockResolvedValue({
        rawText: 'Extracted Text Content',
        name: 'Kaif',
        email: 'kaif@example.com',
      }),
    })
  );

  jest.unstable_mockModule(
    fileURLToPath(new URL('../lib/scrapeGoogleJobs.js', import.meta.url)),
    () => ({
      scrapeGoogleJobs: jest.fn().mockResolvedValue([
        { job_description: 'A long enough job description', score: 0.9 },
      ]),
    })
  );

  jest.unstable_mockModule(
    fileURLToPath(new URL('../lib/semanticMatch.js', import.meta.url)),
    () => ({
      scoreJobs: jest.fn().mockResolvedValue([
        { job_description: 'A long enough job description', score: 0.9 },
      ]),
    })
  );

  jest.unstable_mockModule(
    fileURLToPath(new URL('../lib/extractFrequentKeywords.js', import.meta.url)),
    () => ({
      extractFrequentKeywords: jest.fn().mockReturnValue(['developer', 'javascript']),
    })
  );

  jest.unstable_mockModule(
    fileURLToPath(new URL('../lib/buildOrQuery.js', import.meta.url)),
    () => ({
      buildOrQuery: jest.fn().mockReturnValue('developer OR javascript'),
    })
  );

  // Import handler AFTER mocks are set up
  ({ default: handler } = await import('./upload-resume-clean.js'));
});

describe('upload-resume-clean API handler', () => {
  it('should respond with cleaned resume text', async () => {
    const req = { method: 'POST' };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Analysis complete',
        candidate: expect.objectContaining({
          name: 'Kaif',
          email: 'kaif@example.com',
        }),
        keywords: expect.arrayContaining(['developer', 'javascript']),
      })
    );
  });

  it('should reject non-POST methods', async () => {
    const req = { method: 'GET' };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };

    await handler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Allow', ['POST']);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Method GET Not Allowed' })
    );
  });
});
