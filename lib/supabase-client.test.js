// lib/supabase-client.test.js
import { jest } from '@jest/globals';

jest.unstable_mockModule('lib/supabase-client.js', () => ({
  supabase: { from: jest.fn() }
}));

const { supabase } = await import('lib/supabase-client.js');

test('supabase mock works', () => {
  expect(supabase).toHaveProperty('from');
});