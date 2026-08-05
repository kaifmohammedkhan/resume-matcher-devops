// src/utils/parsePdf.test.js
import { jest } from '@jest/globals';

jest.unstable_mockModule('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  version: '3.0.0',
  getDocument: jest.fn(() => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: jest.fn(() => Promise.resolve({
        getTextContent: jest.fn(() => Promise.resolve({ items: [{ str: 'Hello' }] }))
      }))
    })
  }))
}));

const { extractTextFromPdf } = await import('@/utils/parsePdf.js');

test('extracts text from PDF', async () => {
  const file = new File(['dummy'], 'resume.pdf', { type: 'application/pdf' });
  const result = await extractTextFromPdf(file);
  expect(result).toMatch(/Hello/);
});