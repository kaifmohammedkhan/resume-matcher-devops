// api/resumes.test.js
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.unstable_mockModule('lib/sqlite-db.js', () => ({
  db: { prepare: jest.fn(() => ({ all: jest.fn(() => [{ id: 1 }]) })) }
}));

const handler = (await import('api/resumes.js')).default;
const { db } = await import('lib/sqlite-db.js');

describe('resumes API', () => {
  let app;
  beforeEach(() => {
    app = express();
    app.get('/api/resumes', handler);
  });

  test('returns 200 with rows', async () => {
    const res = await request(app).get('/api/resumes');
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe(1);
  });
});