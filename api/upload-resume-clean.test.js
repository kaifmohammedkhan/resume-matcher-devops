import { jest } from '@jest/globals';

// Shared mock instance so tests can easily configure mockResolvedValue / mockRejectedValue
const mockFormInstance = {
  parse: jest.fn(),
};

// 1. Mock Formidable ES module
jest.unstable_mockModule('formidable', () => {
  const mockFormidableFn = jest.fn(() => mockFormInstance);
  return {
    default: mockFormidableFn,
    formidable: mockFormidableFn,
    IncomingForm: jest.fn(() => mockFormInstance),
  };
});

// 2. Mock Text Extractor module
jest.unstable_mockModule('../lib/extractResumeText.js', () => ({
  extractResumeText: jest.fn().mockResolvedValue('Extracted Text Content'),
}));

// 3. Mock Semantic Matcher (prevents ONNX/Transformers native execution issues during API test)
jest.unstable_mockModule('../lib/semanticMatch.js', () => ({
  scoreJobs: jest.fn().mockResolvedValue([
    { title: 'React Developer', company: 'TechCorp', score: 0.95 },
  ]),
}));

// 4. Mock PostgreSQL Pool to suppress ECONNREFUSED DB errors during unit testing
jest.unstable_mockModule('pg', () => ({
  default: {
    Pool: jest.fn(() => ({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      on: jest.fn(),
    })),
  },
  Pool: jest.fn(() => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    on: jest.fn(),
  })),
}));

// 5. Dynamic import of handler after mocks are registered
const { default: handler } = await import('./upload-resume-clean.js');

describe('Upload Resume API - Comprehensive Suite', () => {
  let req, res;

  beforeEach(() => {
    req = { method: 'POST' };
    res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  test('✅ Successful upload with valid PDF', async () => {
    mockFormInstance.parse.mockResolvedValue([
      {},
      {
        resume: [
          {
            originalFilename: 'my_resume.pdf',
            mimetype: 'application/pdf',
            filepath: '/tmp/my_resume.pdf',
            _writeStream: {
              buffer: Buffer.from('fake pdf data'),
            },
          },
        ],
      },
    ]);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Analysis complete',
        candidate: expect.objectContaining({
          name: 'Extracted Text Content',
        }),
        jobs: expect.arrayContaining([
          expect.objectContaining({
            company: 'TechCorp',
            title: 'React Developer',
          }),
        ]),
      })
    );
  });

  test('❌ Block invalid file extensions (.exe)', async () => {
    mockFormInstance.parse.mockResolvedValue([
      {},
      {
        resume: [
          {
            originalFilename: 'virus.exe',
            mimetype: 'application/x-msdownload',
            filepath: '/tmp/virus.exe',
            _writeStream: {
              buffer: Buffer.from('exe content'),
            },
          },
        ],
      },
    ]);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringMatching(/Invalid file type|Allowed:/i),
      })
    );
  });

  test('❌ Fail if no file is in the payload', async () => {
    mockFormInstance.parse.mockResolvedValue([{}, {}]);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('No resume file uploaded'),
      })
    );
  });

  test('❌ Fail on wrong HTTP method (GET)', async () => {
    req.method = 'GET';

    await handler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Allow', ['POST']);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Method GET Not Allowed'),
      })
    );
  });

  test('❌ Handle internal parsing errors (500)', async () => {
    mockFormInstance.parse.mockRejectedValue(new Error('Crash'));

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'system',
        error: 'Unexpected system error',
      })
    );
  });
});