import { createClient } from '@supabase/supabase-js';

// Essas chaves devem ser configuradas no Supabase Dashboard em Project Settings > API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL ou Anon Key não configuradas. O Cloud Sync não funcionará.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
