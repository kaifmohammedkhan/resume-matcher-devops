import { jest } from '@jest/globals';
import request from 'supertest';
import path from 'node:path';
import fs from 'node:fs';
import client from 'prom-client';

const mockPrepare = jest.fn();

const mockSqliteDb = {
  prepare: mockPrepare,
};

const mockSeedSqliteDatabase = jest.fn();

jest.unstable_mockModule('./api/upload-resume-clean.js', () => ({
  default: (req, res) =>
    res.status(200).json({
      success: true,
      message: 'Mock upload handler',
    }),
}));

jest.unstable_mockModule('./lib/sqlite-db.js', () => ({
  db: mockSqliteDb,
}));

jest.unstable_mockModule('./lib/sqlite-seed.js', () => ({
  seedSqliteDatabase: mockSeedSqliteDatabase,
}));

describe('Server API Endpoints', () => {
  let app;
  let initDB;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_TYPE = 'sqlite';

    const logDir = path.join(process.cwd(), 'logs');

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const serverModule = await import('./server.js');

    app = serverModule.app;
    initDB = serverModule.initDB;

    await initDB();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrepare.mockReturnValue({
      get: jest.fn().mockReturnValue({ '1': 1 }),
      all: jest.fn().mockReturnValue([
        {
          id: 1,
          filename: 'resume1.pdf',
          uploaded_at: '2026-01-01',
        },
      ]),
    });

    mockSeedSqliteDatabase.mockResolvedValue(true);

    delete process.env.WIREMOCK_URL;
  });

  afterAll(() => {
    try {
      client.register.clear();
      client.register.setDefaultLabels({});
    } catch {
      // Ignore cleanup errors
    }
  });

  // ============================================================
  // Health
  // ============================================================

  describe('GET /health', () => {
    it('should return 200 UP status when database is reachable', async () => {
      const res = await request(app).get('/health');

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status', 'UP');
      expect(res.body).toHaveProperty('database', 'connected');
    });

    it('should return database error when database query fails', async () => {
      mockPrepare.mockReturnValue({
        get: jest.fn().mockImplementation(() => {
          throw new Error('Database unavailable');
        }),
      });

      const res = await request(app).get('/health');

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({
        status: 'UP',
        database: 'error',
        error: 'Database unavailable',
      });
    });
  });

  // ============================================================
  // Metrics
  // ============================================================

  describe('GET /metrics', () => {
    it('should return Prometheus metrics format', async () => {
      const res = await request(app).get('/metrics');

      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('resume_matcher_');
    });
  });

  // ============================================================
  // Upload
  // ============================================================

  describe('POST /api/upload-resume-clean', () => {
    it('should route requests to the upload handler', async () => {
      const res = await request(app)
        .post('/api/upload-resume-clean')
        .send({});

      expect(res.statusCode).toBe(200);

      expect(res.body).toEqual({
        success: true,
        message: 'Mock upload handler',
      });
    });
  });

  // ============================================================
  // Resumes
  // ============================================================

  describe('GET /api/resumes', () => {
    it('should return a list of resumes from the database', async () => {
      const res = await request(app).get('/api/resumes');

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty(
        'filename',
        'resume1.pdf'
      );
    });

    it('should return 500 when the database query fails', async () => {
      mockPrepare.mockReturnValue({
        all: jest.fn().mockImplementation(() => {
          throw new Error('Database query failed internally');
        }),
      });

      const res = await request(app).get('/api/resumes');

      expect(res.statusCode).toBe(500);

      expect(res.body).toEqual({
        error: 'Database query failed',
      });
    });
  });

  // ============================================================
  // WireMock jobs
  // ============================================================

  describe('GET /api/jobs', () => {
    it('should return 503 when WireMock is not configured', async () => {
      delete process.env.WIREMOCK_URL;

      const res = await request(app).get('/api/jobs');

      expect(res.statusCode).toBe(503);

      expect(res.body).toEqual({
        error: 'WireMock not configured',
      });
    });

    it('should return WireMock job data when configured', async () => {
      process.env.WIREMOCK_URL =
        'http://127.0.0.1:8080';

      const axiosModule = await import('axios');

      jest
        .spyOn(axiosModule.default, 'get')
        .mockResolvedValueOnce({
          data: {
            results: [
              {
                title: 'Test Engineer',
                work_mode: 'Remote',
              },
            ],
          },
        });

      const res = await request(app).get('/api/jobs');

      expect(res.statusCode).toBe(200);

      expect(res.body).toEqual({
        results: [
          {
            title: 'Test Engineer',
            work_mode: 'Remote',
          },
        ],
      });

      axiosModule.default.get.mockRestore();
    });

    it('should return 500 when WireMock request fails', async () => {
      process.env.WIREMOCK_URL =
        'http://127.0.0.1:8080';

      const axiosModule = await import('axios');

      jest
        .spyOn(axiosModule.default, 'get')
        .mockRejectedValueOnce(
          new Error('WireMock unavailable')
        );

      const res = await request(app).get('/api/jobs');

      expect(res.statusCode).toBe(500);

      expect(res.body).toEqual({
        error: 'WireMock call failed',
        details: 'WireMock unavailable',
      });

      axiosModule.default.get.mockRestore();
    });
  });

  // ============================================================
  // Catch-all frontend route
  // ============================================================

  describe('Catch-all frontend route', () => {
    it('should return 404 when frontend build is not available', async () => {
      const res = await request(app).get(
        '/this-route-does-not-exist'
      );

      expect(res.statusCode).toBe(404);
      expect(res.text).toBe('Frontend build not found');
    });
  });
});