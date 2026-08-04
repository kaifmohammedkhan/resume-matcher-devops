import { jest } from '@jest/globals';
import request from 'supertest';
import path from 'node:path';
import fs from 'node:fs';
import client from 'prom-client';

// 1. Mock dependent modules before importing server.js
jest.unstable_mockModule('./api/upload-resume-clean.js', () => ({
  default: (req, res) =>
    res.status(200).json({ success: true, message: 'Mock upload handler' }),
}));

jest.unstable_mockModule('./lib/sqlite-db.js', () => ({
  db: {
    prepare: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue({ '1': 1 }),
      all: jest.fn().mockReturnValue([
        { id: 1, filename: 'resume1.pdf', uploaded_at: '2026-01-01' },
      ]),
    }),
  },
}));

jest.unstable_mockModule('./lib/sqlite-seed.js', () => ({
  seedSqliteDatabase: jest.fn().mockResolvedValue(true),
}));

describe('Server API Endpoints', () => {
  let app;
  let initDB;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_TYPE = 'sqlite';

    // Ensure logs directory exists
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Dynamic import server modules after mocks are applied
    const serverModule = await import('./server.js');
    app = serverModule.app;
    initDB = serverModule.initDB;

    // Explicitly await DB initialization for test setup
    await initDB();
  });

  afterAll(() => {
    // Clear Prometheus registry to prevent active timers / leaks and event loop issues
    try {
      client.register.clear();
      client.register.setDefaultLabels({});
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('GET /health', () => {
    it('should return 200 UP status when database is reachable', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('status', 'UP');
      expect(res.body).toHaveProperty('database', 'connected');
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus metrics format', async () => {
      const res = await request(app).get('/metrics');
      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain('resume_matcher_');
    });
  });

  describe('POST /api/upload-resume-clean', () => {
    it('should route requests to the upload handler', async () => {
      const res = await request(app)
        .post('/api/upload-resume-clean')
        .send({});

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        success: true,
        message: 'Mock upload handler',
      });
    });
  });

  describe('GET /api/resumes', () => {
    it('should return a list of resumes from the database', async () => {
      const res = await request(app).get('/api/resumes');

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('filename', 'resume1.pdf');
    });
  });
});