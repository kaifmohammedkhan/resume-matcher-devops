import { db } from './sqlite-db.js';

export async function seedSqliteDatabase() {
  try {
    // Create table with uniqueness constraint
    db.prepare(`
      CREATE TABLE IF NOT EXISTS resumes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        skills TEXT,
        uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    console.log('✅ SQLite table check passed');
    console.log('🚫 Skipping static seed — resumes will be uploaded live');
  } catch (err) {
    console.error('❌ SQLite seed error:', err.message);
    throw err;
  }
}
