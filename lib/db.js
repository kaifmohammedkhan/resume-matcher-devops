import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'resume',
  password: process.env.DB_PASS || 'resume123',
  database: process.env.DB_NAME || 'resume_db',
});
