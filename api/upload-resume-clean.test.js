import { jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';

// Mock Text Extractor module using cross-platform URL resolution
jest.unstable_mockModule(
  fileURLToPath(new URL('../lib/extractResumeText.js', import.meta.url)),
  () => ({
    extractResumeText: jest.fn().mockResolvedValue({ rawText: 'Extracted Text Content' }),
  })
);

const { default: handler } = await import('./upload-resume-clean.js');

describe('upload-resume-clean API handler', () => {
  it('should exist and be a function', () => {
    expect(typeof handler).toBe('function');
  });
});