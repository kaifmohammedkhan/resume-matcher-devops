// api/ping-supabase.test.js
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.unstable_mockModule('lib/supabase-client.js', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        limit: jest.fn(() => ({
          data: [{ id: 1 }],
          error: null
        }))
      }))
    }))
  }
}));

const handler = (await import('api/ping-supabase.js')).default;
const { supabase } = await import('lib/supabase-client.js');

describe('ping-supabase API', () => {
  let app;
  beforeEach(() => {
    app = express();
    app.get('/api/ping', handler);
  });

  test('returns 200 when Supabase succeeds', async () => {
    supabase.from = jest.fn(() => ({
      select: jest.fn(() => ({
        limit: jest.fn(() => ({ data: [{ id: 1 }], error: null }))
      }))
    }));

    const res = await request(app).get('/api/ping');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Supabase connected/i);
  });

  test('returns 500 when Supabase fails', async () => {
    supabase.from = jest.fn(() => ({
      select: jest.fn(() => ({
        limit: jest.fn(() => ({ data: null, error: { message: 'fail' } }))
      }))
    }));

    const res = await request(app).get('/api/ping');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('fail');
  });
});