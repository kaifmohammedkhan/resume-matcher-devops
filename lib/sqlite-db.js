import Database from 'better-sqlite3';

const db = new Database('resumes.db');

// Create table if it doesn't exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    skills TEXT
  )
`).run();

export { db };
