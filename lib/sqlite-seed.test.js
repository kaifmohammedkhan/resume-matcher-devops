// lib/sqlite-seed.test.test.js or lib/sqlite-seed.test.js
import { jest } from '@jest/globals';

jest.unstable_mockModule('lib/sqlite-db.js', () => ({
  db: { prepare: jest.fn(() => ({ run: jest.fn() })) }
}));

const { seedSqliteDatabase } = await import('lib/sqlite-seed.js');
const { db } = await import('lib/sqlite-db.js');

test('runs seed without error', async () => {
  db.prepare = jest.fn(() => ({ run: jest.fn() }));
  await expect(seedSqliteDatabase()).resolves.not.toThrow();
});

test('throws on DB error', async () => {
  db.prepare = jest.fn(() => { throw new Error('fail'); });
  await expect(seedSqliteDatabase()).rejects.toThrow('fail');
});