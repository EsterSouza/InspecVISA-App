import { supabase } from '../lib/supabase';

const TIMEOUT_MS = 30000;

function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} demorou demais para responder.`)), TIMEOUT_MS);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export interface ClientPortalVisit {
  public_token: string;
  unit_name: string;
  status: string;
  requested_date: string | null;
  requested_time: string | null;
  report_due_at: string | null;
  created_at: string;
}

export interface ClientPortalUnit {
  client_name: string;
  city: string | null;
  visits: ClientPortalVisit[];
}

export interface ClientPortalOverview {
  account_name: string;
  units: ClientPortalUnit[];
}

const TOKEN_KEY = 'inspecvisa-client-portal-token';

export const clientPortalService = {
  getStoredToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  storeToken(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch { /* armazenamento indisponível */ }
  },

  clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch { /* armazenamento indisponível */ }
  },

  async login(email: string, code: string): Promise<{ portal_token: string; account_name: string }> {
    const { data, error } = await withTimeout(
      supabase.rpc('client_portal_login', { p_email: email, p_code: code }),
      'LoginPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error('E-mail ou código de acesso inválidos.');
    return data as { portal_token: string; account_name: string };
  },

  async overview(token: string): Promise<ClientPortalOverview> {
    const { data, error } = await withTimeout(
      supabase.rpc('client_portal_overview', { p_token: token }),
      'PainelPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error('acesso invalido');
    return data as ClientPortalOverview;
  },
};
