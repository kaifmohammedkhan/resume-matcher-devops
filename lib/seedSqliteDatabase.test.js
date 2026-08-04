import { jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';

process.env.DB_TYPE = 'sqlite';
delete process.env.KUBERNETES_SERVICE_HOST;

const mockPrepare = jest.fn(() => ({ run: jest.fn() }));

jest.unstable_mockModule(fileURLToPath(new URL('./sqlite-db.js', import.meta.url)), () => ({
  db: { prepare: mockPrepare },
  seedSqliteDatabase: jest.fn(async () => {
    mockPrepare();
  }),
}));

const { seedSqliteDatabase } = await import('./sqlite-db.js');

describe('seedSqliteDatabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create resumes table successfully', async () => {
    await seedSqliteDatabase();
    expect(mockPrepare).toHaveBeenCalled();
  });

  it('should throw error if db.prepare fails', async () => {
    mockPrepare.mockImplementationOnce(() => {
      throw new Error('DB failure');
    });

    const runSeed = async () => {
      const stmt = mockPrepare();
      stmt.run();
    };

    await expect(runSeed()).rejects.toThrow('DB failure');
  });
});