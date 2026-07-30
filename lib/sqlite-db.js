import Database from 'better-sqlite3';
import path from 'node:path';

// ✅ Resolve absolute path for SQLite file
// In Docker, this will reside in the container's /app directory
const dbPath = path.resolve('./resumes.sqlite');
const db = new Database(dbPath);

// ✅ PRODUCTION-PARITY SCHEMA
// This matches your Postgres schema exactly, ensuring no logic breaks
db.exec(`
  CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,                 -- 👈 Added UNIQUE to prevent duplicate entries
    skills TEXT,
    score REAL DEFAULT 0,              -- For semantic similarity values (e.g., 0.47)
    match_results TEXT,                -- Stringified JSON array of job matches
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export { db };