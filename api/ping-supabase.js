import { supabase } from '../../lib/supabase-client.js';

export default async function handler(req, res) {
  const { data, error } = await supabase.from('resumes').select('*').limit(1);
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ message: '✅ Supabase connected!', sample: data });
}
