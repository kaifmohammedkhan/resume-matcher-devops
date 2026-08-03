import { jest } from '@jest/globals';

const mockQuery = jest.fn();
const mockConnect = jest.fn(() => ({ host: 'localhost', release: jest.fn() }));

jest.unstable_mockModule('./db.js', () => ({
  pool: { query: mockQuery, connect: mockConnect },
}));

// ✅ Import initDB from server.js
const { initDB } = await import('../server.js');

describe('seedDatabase', () => {
  it('should create table', async () => {
    mockQuery.mockResolvedValue({});
    if (typeof initDB === 'function') {
      await initDB();
    }
    expect(mockQuery).toHaveBeenCalled();
  });
});