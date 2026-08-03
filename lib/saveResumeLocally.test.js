import { jest } from '@jest/globals';

const mockWriteFile = jest.fn();
const mockMkdir = jest.fn();

jest.unstable_mockModule('node:fs/promises', () => {
  const mockFs = {
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
  };
  return {
    ...mockFs,
    default: mockFs, // Handles both named and default import styles safely
  };
});

jest.unstable_mockModule('node:path', () => {
  const mockPath = {
    resolve: () => '/tmp',
    join: (...args) => args.join('/'),
  };
  return {
    ...mockPath,
    default: mockPath,
  };
});

const { saveResumeLocally } = await import('./saveResumeLocally.js');

describe('saveResumeLocally', () => {
  it('should save resume JSON', async () => {
    await saveResumeLocally({ email: 'test@example.com' });
    expect(mockWriteFile).toHaveBeenCalled();
  });
});