import { jest } from '@jest/globals';

describe('sqlite-db', () => {
  it('should initialize db when NODE_ENV !== test', async () => {
    process.env.NODE_ENV = 'production';

    // Mock better-sqlite3 only for this branch
    jest.unstable_mockModule('better-sqlite3', () => ({
      default: jest.fn(() => ({
        exec: jest.fn(),
      })),
    }));

    const { db } = await import('./sqlite-db.js');
    expect(db).toBeDefined();
    expect(typeof db.exec).toBe('function');
  });

  it('should export null db in test mode', async () => {
    process.env.NODE_ENV = 'test';

    // 🚫 Do NOT mock better-sqlite3 here — let sqlite-db.js run naturally
    jest.resetModules(); // clear previous mocks

    const { db } = await import('./sqlite-db.js');
    expect(db).toBeNull();
  });
});
