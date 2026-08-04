import { jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';

jest.unstable_mockModule(
  fileURLToPath(new URL('../controllers/resumeController.js', import.meta.url)),
  () => ({
    handleResumeUpload: jest.fn((req, res) => res.json({ ok: true })),
  })
);

const { default: router } = await import(
  fileURLToPath(new URL('./resume.js', import.meta.url))
);

describe('resume', () => {
  it('should export an Express router', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });
});