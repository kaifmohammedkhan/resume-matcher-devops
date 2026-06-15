import { jest } from '@jest/globals';

// We must mock the module structure to include the IncomingForm constructor
jest.unstable_mockModule('formidable', () => {
  const mockForm = {
    parse: jest.fn()
  };
  return {
    default: {
      IncomingForm: jest.fn(() => mockForm)
    }
  };
});

jest.unstable_mockModule('../lib/extractResumeText.js', () => ({
  extractResumeText: jest.fn().mockResolvedValue('Extracted Text Content')
}));

const { default: handler } = await import('./upload-resume-clean.js');

describe('Upload Resume API - Comprehensive Suite', () => {
  let req, res;

  beforeEach(() => {
    req = { method: 'POST' };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    jest.clearAllMocks();
  });

  test('✅ Successful upload with valid PDF', async () => {
    const { default: formidable } = await import('formidable');
    const mockFormInstance = new formidable.IncomingForm();
    mockFormInstance.parse.mockResolvedValue([{}, { 
      resume: [{ originalFilename: 'my_resume.pdf' }] 
    }]);

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('❌ Block invalid file extensions (.exe)', async () => {
    const { default: formidable } = await import('formidable');
    const mockFormInstance = new formidable.IncomingForm();
    mockFormInstance.parse.mockResolvedValue([{}, { 
      resume: [{ originalFilename: 'virus.exe' }] 
    }]);

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('❌ Fail if no file is in the payload', async () => {
    const { default: formidable } = await import('formidable');
    const mockFormInstance = new formidable.IncomingForm();
    mockFormInstance.parse.mockResolvedValue([{}, {}]); 

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('❌ Fail on wrong HTTP method (GET)', async () => {
    req.method = 'GET';
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  test('❌ Handle internal parsing errors (500)', async () => {
    const { default: formidable } = await import('formidable');
    const mockFormInstance = new formidable.IncomingForm();
    mockFormInstance.parse.mockRejectedValue(new Error('Crash'));

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});