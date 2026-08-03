import { db } from './sqlite-db.js';

describe('sqlite-db', () => {
  it('should export db instance', () => {
    expect(db).toBeDefined();
    expect(typeof db.exec).toBe('function');
  });
});
``