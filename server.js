import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import handler from './api/upload-resume-clean.js';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

dotenv.config(); // ✅ Load .env early

const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 🔍 Debug loaded env vars
console.log('🔍 GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY || '❌ Missing');
console.log('🔍 GOOGLE_CX_ID:', process.env.GOOGLE_CX_ID || '❌ Missing');
console.log('🔍 DB_TYPE:', process.env.DB_TYPE || '❌ Missing');

// ✅ DB setup: PostgreSQL or SQLite
let useSqlite = process.env.DB_TYPE === 'sqlite';
let db, seed;

if (useSqlite) {
  console.log('🧩 Using SQLite');
  ({ db } = await import('./lib/sqlite-db.js'));
  ({ seedSqliteDatabase: seed } = await import('./lib/sqlite-seed.js'));
} else {
  console.log('🧩 Using PostgreSQL');
  ({ pool: db } = await import('./lib/db.js'));
  ({ seedDatabase: seed } = await import('./lib/seed.js'));
}

// ✅ Seed DB on startup
seed().catch(err => console.error('❌ DB seed error:', err.message));

// ✅ Logging middleware
app.use(morgan('combined'));

// ✅ Rate limiting middleware
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
});
app.use(limiter);

// ✅ Parse incoming JSON
app.use(express.json());

// ✅ Serve static frontend files
const staticPath = path.resolve(__dirname, 'dist');
console.log('📁 Serving static files from:', staticPath);

app.use(express.static(staticPath, {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    res.setHeader('X-Served-By', 'resume-matcher');
  }
}));

// ✅ Resume upload API
app.post('/api/upload-resume-clean', (req, res) => {
  console.log('📨 Incoming resume upload');
  handler(req, res);
});

// ✅ Resume fetch API
app.get('/api/resumes', async (req, res) => {
  try {
    let rows;
    if (useSqlite) {
      rows = db.prepare('SELECT * FROM resumes').all();
    } else {
      const result = await db.query('SELECT * FROM resumes');
      rows = result.rows;
    }
    res.json(rows);
  } catch (err) {
    console.error('❌ DB query failed:', err.message);
    res.status(500).send('Database error');
  }
});

// ✅ Health check
app.get('/health', (req, res) => res.status(200).send('OK'));

// ✅ SPA fallback route (GET-only, Node.js v22-safe)
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();

  const indexPath = path.join(staticPath, 'index.html');

  fs.access(indexPath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('❌ index.html not found at:', indexPath);
      return res.status(404).send('Frontend not found');
    }

    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('❌ Error sending index.html:', err);
        res.status(500).send('Internal Server Error');
      }
    });
  });
});

// ✅ Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
