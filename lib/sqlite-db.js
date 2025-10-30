import Database from 'better-sqlite3';
import path from 'path';

// ✅ Resolve absolute path for SQLite file
const dbPath = path.resolve('./resumes.sqlite');
const db = new Database(dbPath);

// ✅ Create table with timestamp and unique email
db.exec(`
  CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    skills TEXT,
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

export { db };
