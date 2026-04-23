import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { getCurrentTenant, clearAuthCache } from '../services/authService';
import type { TenantInfo } from '../services/authService';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  tenantInfo: TenantInfo | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tenantInfo: null,
      loading: true,
      initialized: false,
      setUser: (user) => set({ user, loading: false }),
      signOut: async () => {
        await supabase.auth.signOut().catch(() => {});
        clearAuthCache();
        set({ user: null, tenantInfo: null });
      },
      initialize: async () => {
        // Fallback de segurança: se após 8s ainda não inicializou, força a barra para não travar a UI.
        const timeoutId = setTimeout(() => {
          if (!get().initialized) {
            console.warn('[Auth] Initialization timeout - forcing ready state');
            set({ initialized: true, loading: false });
          }
        }, 8000);

        // ✅ OFFLINE-FIRST: If we already have persisted (cached) user state,
        // mark as initialized immediately — app opens without waiting for network.
        const persisted = get();
        if (persisted.user) {
          set({ initialized: true, loading: false });
          clearTimeout(timeoutId);

          // Validate session silently in background (non-blocking).
          Promise.resolve().then(async () => {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) {
                // Session expired — force re-login
                set({ user: null, tenantInfo: null });
              } else if (!persisted.tenantInfo) {
                const t = await getCurrentTenant().catch(() => null);
                set({ tenantInfo: t });
              }
            } catch {
              // Network unavailable — keep cached state as-is
            }
          });
        } else {
          // No cached user — must fetch from network
          try {
            // Using a simple timeout wrapper for the critical path
            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
            const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any;
            
            const user = session?.user ?? null;
            let tenantInfo = null;
            if (user) {
              const tenantPromise = getCurrentTenant();
              tenantInfo = await Promise.race([tenantPromise, timeoutPromise]).catch(() => null);
            }
            clearTimeout(timeoutId);
            set({ user, tenantInfo, loading: false, initialized: true });
          } catch {
            // Network error and no cached state — show login page
            clearTimeout(timeoutId);
            set({ user: null, tenantInfo: null, loading: false, initialized: true });
          }
        }

        // Listen for future auth state changes
        supabase.auth.onAuthStateChange(async (_event, session) => {
          const u = session?.user ?? null;
          let t: TenantInfo | null = null;
          if (u) {
            t = await getCurrentTenant().catch(() => null);
          }
          set({ user: u, tenantInfo: t });
        });
      },
    }),
    {
      name: 'inspec-visa-auth',
      partialize: (state) => ({
        user: state.user,
        tenantInfo: state.tenantInfo,
      }),
    }
  )
);
