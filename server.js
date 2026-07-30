import express from 'express';
import path from 'node:path';
import fs, { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import handler from './api/upload-resume-clean.js';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import helmet from 'helmet';
import client from 'prom-client';   // ✅ Prometheus client

// ✅ Load .env and log GOOGLE_API_KEY only
dotenv.config();
console.log("🔑 GOOGLE_API_KEY:", process.env.GOOGLE_API_KEY ? "Loaded" : "Missing");
// CX_ID stays defined in .env but is ignored in logic

const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ✅ Security Hardening
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https:"],
      "script-src": ["'self'", "'unsafe-inline'"], 
    },
  },
}));
app.disable('x-powered-by');

// ✅ Logging setup
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
const accessLogStream = createWriteStream(path.join(logDir, 'access.log'), { flags: 'a' });

app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev')); 

// ✅ Prometheus metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'resume_matcher_' });

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// ✅ Global DB variables
let useSqlite = process.env.DB_TYPE === 'sqlite';
let db, seed;

// ✅ DB Initialization (non-blocking)
const initDB = async () => {
  try {
    if (useSqlite) {
      console.log('🧩 Environment: LOCAL (SQLite)');
      ({ db } = await import('./lib/sqlite-db.js'));
      ({ seedSqliteDatabase: seed } = await import('./lib/sqlite-seed.js'));
    } else {
      console.log('🧩 Environment: KUBERNETES (PostgreSQL)');
      ({ pool: db } = await import('./lib/db.js'));
      ({ seedDatabase: seed } = await import('./lib/seed.js'));
    }

    await seed();
    console.log('✅ Database connected and seeded');
  } catch (err) {
    console.error(`⚠️ DB init failed (non-blocking): ${err.message}`);
  }
};

// ✅ Middleware
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100, 
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use(express.json());

// ✅ Health check
app.get('/health', async (req, res) => {
  try {
    if (!db) return res.status(200).json({ status: 'UP', database: 'disconnected' });
    useSqlite ? db.prepare('SELECT 1').get() : await db.query('SELECT 1');
    res.status(200).json({ status: 'UP', database: 'connected' });
  } catch (err) {
    res.status(200).json({ status: 'UP', database: 'error', error: err.message });
  }
});

// ✅ Routes
const staticPath = path.resolve(__dirname, 'dist');
app.use(express.static(staticPath, {
  maxAge: '1d',
  setHeaders: (res) => res.setHeader('X-Served-By', 'resume-matcher-devops')
}));

app.post('/api/upload-resume-clean', handler);

app.get('/api/resumes', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not initialized' });
    let rows = useSqlite 
      ? db.prepare('SELECT * FROM resumes ORDER BY uploaded_at DESC').all() 
      : (await db.query('SELECT * FROM resumes ORDER BY uploaded_at DESC')).rows;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ✅ Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'), (err) => {
    if (err) res.status(404).send('Frontend build not found');
  });
});

// ✅ Startup & Shutdown
const server = app.listen(port, '0.0.0.0', async () => {
  await initDB();
  console.log(`🚀 Production server ready at http://0.0.0.0:${port}`);
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated.');
    process.exit(0);
  });
});
