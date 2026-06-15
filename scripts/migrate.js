import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

const migrations = [
  `
  CREATE TABLE IF NOT EXISTS resumes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    skills TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    resume_id INTEGER REFERENCES resumes(id) ON DELETE CASCADE,
    job_title TEXT NOT NULL,
    score INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `
];

async function runMigrations() {
  try {
    await client.connect();
    console.log('🔧 Connected to DB');

    for (const query of migrations) {
      await client.query(query);
      console.log('✅ Migration applied');
    }

    console.log('🎉 All migrations completed');
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
