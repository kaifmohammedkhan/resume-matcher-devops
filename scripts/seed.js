import { Client } from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto'; // ✅ Secure random generator
dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

const seedData = async () => {
  try {
    await client.connect();
    console.log('🌱 Connected to DB for seeding');

    // Sample resume entries
    const resumes = [
      {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        skills: ['JavaScript', 'React', 'Node.js']
      },
      {
        name: 'Bob Singh',
        email: 'bob@example.com',
        skills: ['Python', 'Django', 'PostgreSQL']
      }
    ];

    for (const resume of resumes) {
      const result = await client.query(
        `INSERT INTO resumes (name, email, skills) VALUES ($1, $2, $3) RETURNING id`,
        [resume.name, resume.email, resume.skills]
      );
      const resumeId = result.rows[0].id;

      // ✅ Use crypto.randomInt instead of Math.random
      const score = crypto.randomInt(0, 100);

      // Sample match for each resume
      await client.query(
        `INSERT INTO matches (resume_id, job_title, score) VALUES ($1, $2, $3)`,
        [resumeId, 'Software Engineer', score]
      );
    }

    console.log('✅ Seeding complete');
  } catch (err) {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
};

seedData();
