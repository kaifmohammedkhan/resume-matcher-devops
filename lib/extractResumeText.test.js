import { jest } from '@jest/globals';

// 1. Mock the dependency BEFORE any imports
jest.unstable_mockModule('./pdfParseWrapper.js', () => ({
  parseWithMetadata: jest.fn(),
}));

// 2. Dynamic imports to ensure the mock is applied
const { extractResumeText } = await import('./extractResumeText.js');
const { parseWithMetadata } = await import('./pdfParseWrapper.js');

describe('extractResumeText', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should extract text and identify bold metadata from a Buffer', async () => {
    // Mocking the behavior of the PDF parser
    parseWithMetadata.mockResolvedValue({
      text: 'John Doe Resume Content',
      metadata: [
        { text: 'WORK EXPERIENCE', fontWeight: 700 },
        { text: 'Senior Developer', fontName: 'Helvetica-Bold' },
        { text: 'regular contact info', fontWeight: 400 }
      ]
    });

    const result = await extractResumeText(Buffer.from('fake-pdf-data'));
    
    expect(result.rawText).toBe('John Doe Resume Content');
    expect(result.highlighted).toContain('WORK EXPERIENCE');
    expect(result.highlighted).toContain('Senior Developer');
    expect(result.highlighted).not.toContain('regular contact info');
  });

  it('should handle local file paths (string input)', async () => {
    parseWithMetadata.mockResolvedValue({ text: 'File content', metadata: [] });

    // Using package.json as a dummy file that definitely exists in your root
    const result = await extractResumeText('./package.json');
    
    expect(result.rawText).toBe('File content');
    expect(parseWithMetadata).toHaveBeenCalled();
  });

  it('should throw an error for invalid input types', async () => {
    // Tests the 'else' branch for input validation
    await expect(extractResumeText(12345))
      .rejects.toThrow('Invalid resume input: must be Buffer or file path');
  });

  it('should catch and re-throw errors from the parser', async () => {
    // Tests the catch block (lines 45-46)
    parseWithMetadata.mockRejectedValue(new Error('Parser Failure'));

    await expect(extractResumeText(Buffer.from('test')))
      .rejects.toThrow('Resume parse failed: Parser Failure');
  });
});