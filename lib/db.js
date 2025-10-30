import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'resume_user',
  password: process.env.DB_PASS || 'resume_pass',
  database: process.env.DB_NAME || 'resume_db',
});
