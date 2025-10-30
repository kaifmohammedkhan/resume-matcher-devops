import { createClient } from '@supabase/supabase-js';

// Load from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);
