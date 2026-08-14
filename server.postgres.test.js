import { jest } from '@jest/globals';

const mockPool = {
  query: jest.fn(),
};

const mockSeedDatabase = jest.fn();

jest.unstable_mockModule('./lib/db.js', () => ({
  pool: mockPool,
}));

jest.unstable_mockModule('./lib/seed.js', () => ({
  seedDatabase: mockSeedDatabase,
}));

describe('PostgreSQL DB initialization', () => {
  let initDB;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_TYPE = 'postgres';

    const serverModule = await import('./server.js');

    initDB = serverModule.initDB;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSeedDatabase.mockResolvedValue(true);
  });

  it('should initialize PostgreSQL database and seed it', async () => {
    await initDB();

    expect(mockSeedDatabase).toHaveBeenCalledTimes(1);
  });

  it('should handle PostgreSQL initialization failure without crashing', async () => {
    mockSeedDatabase.mockRejectedValueOnce(
      new Error('PostgreSQL unavailable')
    );

    await expect(initDB()).resolves.toBeUndefined();

    expect(mockSeedDatabase).toHaveBeenCalledTimes(1);
  });
});