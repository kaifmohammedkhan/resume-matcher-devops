import express from 'express';
import path from 'node:path';
import fs, { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import handler from './api/upload-resume-clean.js';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import helmet from 'helmet';
import client from 'prom-client';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================
// Startup Banner / Env Checks
// ============================================================

const apiKey =
  process.env.GOOGLE_API_KEY ||
  process.env.SERPAPI_KEY ||
  process.env.GOOGLE_JOBS_API_KEY;

if (apiKey) {
  console.log('🔑 GOOGLE_API_KEY: Loaded');
} else {
  console.log('⚠️ GOOGLE_API_KEY: Not Found');
}

const dbTypeLabel =
  process.env.DB_TYPE === 'sqlite'
    ? 'SQLite'
    : 'KUBERNETES (PostgreSQL)';

console.log(`🧩 Environment: ${dbTypeLabel}`);

// ============================================================
// Security Hardening
// ============================================================

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', 'https:'],
        'script-src': ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

app.disable('x-powered-by');

// ============================================================
// Logging Setup
// ============================================================

const logDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const accessLogStream = createWriteStream(
  path.join(logDir, 'access.log'),
  {
    flags: 'a',
  }
);

if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: accessLogStream,
    })
  );

  app.use(morgan('dev'));
}

// ============================================================
// Prometheus Metrics
// ============================================================

const collectDefaultMetrics = client.collectDefaultMetrics;

collectDefaultMetrics({
  prefix: 'resume_matcher_',
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// ============================================================
// Global DB Variables
// ============================================================

let useSqlite = process.env.DB_TYPE === 'sqlite';
let db;
let seed;

// ============================================================
// DB Initialization (Non-blocking)
// ============================================================

export const initDB = async () => {
  try {
    if (useSqlite) {
      ({ db } = await import('./lib/sqlite-db.js'));

      ({ seedSqliteDatabase: seed } = await import(
        './lib/sqlite-seed.js'
      ));
    } else {
      ({ pool: db } = await import('./lib/db.js'));

      ({ seedDatabase: seed } = await import('./lib/seed.js'));
    }

    if (seed) {
      console.log('🛠️ Seeding database...');
      await seed();
    }
  } catch (err) {
    console.error('❌ DB seed error:', err);
    console.warn('⚠️ DB init failed (non-blocking)');
  }
};

// ============================================================
// Rate Limiting
//
// Default:
//   100 requests / 60 seconds
//
// Optional override for dedicated load-test deployments:
//
//   RATE_LIMIT_MAX=10000
//
// If RATE_LIMIT_MAX is not defined, the application automatically
// falls back to the production-safe default of 100.
//
// The rate-limit window remains fixed at 60 seconds.
// ============================================================

const rateLimitMax = Number(
  process.env.RATE_LIMIT_MAX || 100
);

console.log(
  `🛡️ Rate limit: ${rateLimitMax} requests / 60 seconds`
);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(express.json());

// ============================================================
// Health Check
// ============================================================

app.get('/health', async (req, res) => {
  try {
    if (!db) {
      return res.status(200).json({
        status: 'UP',
        database: 'disconnected',
      });
    }

    useSqlite
      ? db.prepare('SELECT 1').get()
      : await db.query('SELECT 1');

    res.status(200).json({
      status: 'UP',
      database: 'connected',
    });
  } catch (err) {
    res.status(200).json({
      status: 'UP',
      database: 'error',
      error: err.message,
    });
  }
});

// ============================================================
// Routes
// ============================================================

const staticPath = path.resolve(__dirname, 'dist');

app.use(
  express.static(staticPath, {
    maxAge: '1d',
    setHeaders: (res) =>
      res.setHeader(
        'X-Served-By',
        'resume-matcher-devops'
      ),
  })
);

app.post('/api/upload-resume-clean', handler);

app.get('/api/resumes', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        error: 'Database not initialized',
      });
    }

    const rows = useSqlite
      ? db
          .prepare(
            'SELECT * FROM resumes ORDER BY uploaded_at DESC'
          )
          .all()
      : (
          await db.query(
            'SELECT * FROM resumes ORDER BY uploaded_at DESC'
          )
        ).rows;

    res.json(rows);
  } catch (err) {
    res.status(500).json({
      error: 'Database query failed',
    });
  }
});

// ============================================================
// Catch-all
// ============================================================

app.get('*', (req, res) => {
  res.sendFile(
    path.join(staticPath, 'index.html'),
    (err) => {
      if (err) {
        res
          .status(404)
          .send('Frontend build not found');
      }
    }
  );
});

// ============================================================
// Conditional Startup
// Skip auto-listen during Jest tests
// ============================================================

const server =
  process.env.NODE_ENV !== 'test'
    ? app.listen(
        port,
        '0.0.0.0',
        async () => {
          await initDB();

          console.log(
            `🚀 Production server ready at http://0.0.0.0:${port}`
          );
        }
      )
    : null;

// ============================================================
// Graceful Shutdown
// ============================================================

process.on('SIGTERM', () => {
  if (server) {
    server.close(() => {
      process.exit(0);
    });
  }
});

// ============================================================
// Exports
// ============================================================

export { app, server };