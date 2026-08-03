import { pool } from './db.js';

describe('db connection', () => {
  it('should expose a pool object', () => {
    expect(pool).toBeDefined();
    expect(typeof pool.query).toBe('function');
  });
});
