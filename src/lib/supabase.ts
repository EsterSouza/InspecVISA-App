import { createClient } from '@supabase/supabase-js';
import { rawErrorMessage } from '../utils/errors';

// Essas chaves devem ser configuradas no Supabase Dashboard em Project Settings > API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL ou Anon Key não configuradas. O Cloud Sync não funcionará.');
}

// Custom fetch with retry to handle transient network issues and timeouts
const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let attempts = 0;
  const maxAttempts = 2; // 1 original + 1 retry

  while (attempts < maxAttempts) {
    try {
      return await fetch(input, init);
    } catch (err) {
      attempts++;
      const nome = err instanceof Error ? err.name : '';
      const mensagem = rawErrorMessage(err) ?? '';
      const isTimeout = nome === 'AbortError' || mensagem.includes('timeout') || mensagem.includes('ETIMEDOUT');
      const isNetworkError = mensagem.includes('Failed to fetch') || mensagem.includes('NetworkError');

      if (attempts < maxAttempts && (isTimeout || isNetworkError)) {
        console.warn(`[Supabase] Fetch failed (${mensagem}), retrying... (Attempt ${attempts + 1}/${maxAttempts})`);
        // Wait 1s before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Fetch failed after retries');
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: customFetch
  }
});
