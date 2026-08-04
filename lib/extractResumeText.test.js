import { jest } from '@jest/globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

jest.unstable_mockModule(fileURLToPath(new URL('./pdfParseWrapper.js', import.meta.url)), () => ({
  parseWithMetadata: jest.fn(),
}));

jest.unstable_mockModule('node:fs/promises', () => ({
  default: {
    readFile: jest.fn(() => Promise.resolve(Buffer.from('mock pdf binary content'))),
  },
  readFile: jest.fn(() => Promise.resolve(Buffer.from('mock pdf binary content'))),
}));

const { extractResumeText } = await import('./extractResumeText.js');
const { parseWithMetadata } = await import('./pdfParseWrapper.js');

describe('extractResumeText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should extract text and identify bold metadata from a Buffer', async () => {
    parseWithMetadata.mockResolvedValue({
      text: 'John Doe Resume Content',
      metadata: [
        { text: 'WORK EXPERIENCE', fontWeight: 700 },
        { text: 'Senior Developer', fontName: 'Helvetica-Bold' },
        { text: 'regular contact info', fontWeight: 400 },
      ],
    });

    const result = await extractResumeText(Buffer.from('fake-pdf-data'));

    expect(result.rawText).toBe('John Doe Resume Content');
    expect(result.highlighted).toContain('WORK EXPERIENCE');
    expect(result.highlighted).toContain('Senior Developer');
    expect(result.highlighted).not.toContain('regular contact info');
  });

  it('should handle local file paths (string input)', async () => {
    parseWithMetadata.mockResolvedValue({
      text: 'File content',
      metadata: [],
    });

    const result = await extractResumeText('sample.pdf');

    expect(result.rawText).toBe('File content');
    expect(parseWithMetadata).toHaveBeenCalledTimes(1);
  });

  it('should throw an error for invalid input types', async () => {
    await expect(extractResumeText(12345)).rejects.toThrow(
      'Resume parse failed: Invalid resume input: must be Buffer or file path'
    );
  });

  it('should catch and re-throw errors from the parser', async () => {
    parseWithMetadata.mockRejectedValue(new Error('Parser Failure'));

    await expect(extractResumeText(Buffer.from('test'))).rejects.toThrow(
      'Resume parse failed: Parser Failure'
    );
  });
});