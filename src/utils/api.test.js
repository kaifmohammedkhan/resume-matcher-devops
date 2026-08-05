import { jest } from '@jest/globals';
import axios from 'axios';
import { uploadResume, getJobDetail } from './api.js';

test('uploadResume posts file', async () => {
  const mockRes = { data: { ok: true } };
  axios.post = jest.fn(() => Promise.resolve(mockRes));
  const file = new File(['resume'], 'resume.pdf', { type: 'application/pdf' });
  const result = await uploadResume(file);
  expect(result.ok).toBe(true);
});

test('getJobDetail fetches job', async () => {
  const mockRes = { data: { id: 1 } };
  axios.get = jest.fn(() => Promise.resolve(mockRes));
  const result = await getJobDetail(1);
  expect(result.id).toBe(1);
});
