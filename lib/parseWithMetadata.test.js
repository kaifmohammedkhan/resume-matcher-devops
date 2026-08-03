import { jest } from '@jest/globals';

const mockGetDocument = jest.fn();
jest.unstable_mockModule('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: mockGetDocument,
}));

// ✅ Updated to point to pdfParseWrapper.js in lib/
const { parseWithMetadata } = await import('./pdfParseWrapper.js');

describe('parseWithMetadata', () => {
  it('should parse PDF and return text', async () => {
    const fakePage = { getTextContent: () => ({ items: [{ str: 'Hello' }] }) };
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 1, getPage: () => fakePage }),
    });

    const result = await parseWithMetadata(Buffer.from('test'));
    expect(result.text).toContain('Hello');
  });

  it('should fallback on error', async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.reject(new Error('fail')) });
    const result = await parseWithMetadata(Buffer.from('abc'));
    expect(result.text).toContain('abc');
  });
});