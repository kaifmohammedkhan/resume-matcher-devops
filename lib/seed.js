import { pool } from './db.js';

export async function seedDatabase() {
  try {
    console.log('🔧 Seeding database...');

    // Test connection
    const client = await pool.connect();
    console.log('🗃️ Connected to PostgreSQL at:', client.host || 'unknown');
    client.release();

    // Create table with uniqueness constraint
    await pool.query(`
      CREATE TABLE IF NOT EXISTS resumes (
        id SERIAL PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        skills TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table check passed');

    // No static seed — real-time uploads only
    console.log('🚫 Skipping static seed — resumes will be uploaded live');
  } catch (err) {
    console.error('❌ DB seed error:', err.message);
    throw err;
  }
}
