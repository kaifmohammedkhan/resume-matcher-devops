import { db } from './sqlite-db.js';

describe('sqlite-db', () => {
  it('should export db instance or null in test mode', () => {
    if (process.env.NODE_ENV === 'test') {
      // In CI/Jest, db is intentionally null to avoid native binding errors
      expect(db).toBeNull();
    } else {
      // In dev/prod, db should be a live instance
      expect(db).toBeDefined();
      expect(typeof db.exec).toBe('function');
    }
  });
});
