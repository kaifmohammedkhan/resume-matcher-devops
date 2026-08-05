import Database from 'better-sqlite3';
import path from 'node:path';

const db = process.env.NODE_ENV !== 'test'
  ? (() => {
      const dbPath = path.resolve('./resumes.sqlite');
      const instance = new Database(dbPath);

      instance.exec(`
        CREATE TABLE IF NOT EXISTS resumes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          email TEXT UNIQUE,
          skills TEXT,
          score REAL DEFAULT 0,
          match_results TEXT,
          uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      return instance;
    })()
  : null;

export { db };
