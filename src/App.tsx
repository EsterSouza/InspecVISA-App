import { supabase } from './lib/supabase';
import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { initializeDatabase } from './db/database';
import { getTemplates } from './data/templates';
import { useSettingsStore } from './store/useSettingsStore';
import { useAuthStore } from './store/useAuthStore';
import { Loader2 } from 'lucide-react';
import { SyncIndicator } from './components/ui/SyncIndicator';
import { SyncQueueService } from './services/syncQueueService';

// Layout
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';

// Lazy Loaded Pages
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Clients = lazy(() => import('./pages/Clients').then(m => ({ default: m.Clients })));
const ClientDetails = lazy(() => import('./pages/ClientDetails').then(m => ({ default: m.ClientDetails })));
const Schedules = lazy(() => import('./pages/Schedules').then(m => ({ default: m.Schedules })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Inspections = lazy(() => import('./pages/Inspections').then(m => ({ default: m.Inspections })));
const NewInspection = lazy(() => import('./pages/NewInspection').then(m => ({ default: m.NewInspection })));
const InspectionExecution = lazy(() => import('./pages/InspectionExecution').then(m => ({ default: m.InspectionExecution })));
const InspectionSummary = lazy(() => import('./pages/InspectionSummary').then(m => ({ default: m.InspectionSummary })));
const AccessDenied = lazy(() => import('./pages/AccessDenied').then(m => ({ default: m.AccessDenied })));

const AdminLayout = lazy(() => import('./components/layout/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminTemplates = lazy(() => import('./pages/admin/AdminTemplates').then(m => ({ default: m.AdminTemplates })));
const SmartImporter = lazy(() => import('./pages/admin/SmartImporter').then(m => ({ default: m.SmartImporter })));
const LegislationsManager = lazy(() => import('./pages/admin/LegislationsManager').then(m => ({ default: m.LegislationsManager })));
const TemplateDetail = lazy(() => import('./pages/TemplateDetail').then(m => ({ default: m.TemplateDetail })));
const TemplateEditor = lazy(() => import('./pages/admin/TemplateEditor').then(m => ({ default: m.TemplateEditor })));

import { ProtectedRoute } from './components/ProtectedRoute';
import { ProfileSelection } from './pages/ProfileSelection';
import { Login } from './pages/Login';

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const theme = useSettingsStore((s) => s.settings.theme);
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const doReset = () => {
    localStorage.clear();
    const req = indexedDB.deleteDatabase('InspectionDB');
    req.onsuccess = () => window.location.reload();
    req.onerror = () => window.location.reload();
    req.onblocked = () => window.location.reload();
  };

  useEffect(() => {
    let didCancel = false;

    const initApp = async () => {
      console.log('🚀 Iniciando InspecVISA Step 1/4: Auth...');
      // Step 1: Initialize auth (instant from cache if previously logged in)
      await initialize();

      console.log('🚀 Iniciando InspecVISA Step 2/4: Database...');
      // Step 2: Load static templates immediately into Dexie (offline-safe)
      try {
        // 1. Pre-flight session check (refreshes token if needed)
        const isAuthorized = await useAuthStore.getState().checkSession();
        if (!isAuthorized && useAuthStore.getState().user) {
          console.warn('[App] Session check failed, user state cleared');
        }

        // 2. Initialize Database & Templates
        const staticTemplates = getTemplates();
        const dbPromise = initializeDatabase(staticTemplates);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000));
        await Promise.race([dbPromise, timeoutPromise]);
      } catch (dbErr: unknown) {
        const error = dbErr as Error;
        const isBackingStoreError =
          error?.name === 'UnknownError' ||
          error?.message?.includes('backing store');
        if (isBackingStoreError) {
          doReset();
          return;
        }
        console.warn('[App] DB init error (non-fatal):', dbErr);
      }

      console.log('🚀 Iniciando InspecVISA Step 3/4: Rendering UI...');
      // Step 3: App is ready — show it!
      if (!didCancel) setIsInitializing(false);

      console.log('🚀 Iniciando InspecVISA Step 4/4: Background sync...');
      // Step 4: Fetch remote templates in background (non-blocking)
      if (navigator.onLine) {
        void (async () => {
          // LOCK: Ensure session is consolidated before background network calls
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          import('./services/templateService').then(async ({ TemplateService }) => {
            try {
            const remoteTemplates = await TemplateService.syncAllTemplatesToDexie();
            if (remoteTemplates?.length) {
              await initializeDatabase([...getTemplates(), ...remoteTemplates]);
            }
          } catch (tErr) {
            console.warn('[App] Remote templates fetch failed (non-fatal):', tErr);
          }
        }).catch(() => {});

        // One-time repair: restore clients incorrectly soft-deleted by a previous bug
        void (async () => {
          try {
            const { db } = await import('./db/database');
            const { supabase } = await import('./lib/supabase');
            const { data: remoteClients } = await supabase
              .from('clients').select('id').is('deleted_at', null);
            if (!remoteClients?.length) return;
            const remoteIds = new Set(remoteClients.map((c: any) => c.id));
            const localClients = await db.clients.toArray();
            for (const client of localClients) {
              if (client.deletedAt && remoteIds.has(client.id)) {
                console.log('[App] Restoring incorrectly soft-deleted client:', client.name);
                await db.clients.update(client.id, { deletedAt: null, syncStatus: 'synced' as const });
              }
            }
          } catch { /* non-fatal */ }
        })();
      }
    };

    // Safety fallback: se o initApp travar completamente por 25s, libera a UI
    const safetyTimer = setTimeout(() => {
      if (!didCancel) {
        console.warn('[App] Master init timeout. Forcing UI load.');
        setIsInitializing(false);
      }
    }, 25000);

    initApp().catch((err) => {
      console.error('[App] Fatal init error:', err);
      if (!didCancel) setIsInitializing(false);
    }).finally(async () => {
      clearTimeout(safetyTimer);
      try {
        // 3. Clear stuck syncs from previous session
        await SyncQueueService.cleanupStuckSyncing();
        
        // 4. Start background sync
        SyncQueueService.start();

        // 5. Reconcile any corrupted local IDs
        await reconcileCorruptedIds();
      } catch (err) {
        console.error('[App] Post-init sync error:', err);
      }
    });

    // Warning before leaving with pending items
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (SyncQueueService.hasPending()) {
        e.preventDefault();
        e.returnValue = 'Você tem alterações pendentes que ainda não foram salvas na nuvem. Deseja realmente sair?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => { 
      didCancel = true; 
      clearTimeout(safetyTimer); 
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [initialize]);

  // Online Status & Connectivity Check
  useEffect(() => {
    // We could add a global listener for online/offline here if needed for UI
    const handleOnline = () => console.log('🌐 App Online');
    const handleOffline = () => console.log('🚫 App Offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const name = useSettingsStore((s) => s.settings.name);

  if (!initialized || isInitializing) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary-600 mb-4" />
        <p className="text-gray-500 font-medium">Conectando ao InspecVISA...</p>
        <div className="mt-4"><SyncIndicator /></div>
      </div>
    );
  }

  if (!user) return <Login />;
  if (!name) return <ProfileSelection />;

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-gray-50 font-sans text-gray-900 antialiased">
        <div className="hidden lg:block">
           <Routes>
             <Route path="/execute" element={null} />
             <Route path="*" element={<Sidebar />} />
           </Routes>
        </div>

        <main className="flex-1 overflow-y-auto w-full relative pb-24 lg:pb-0">
          <Suspense fallback={
            <div className="flex h-full items-center justify-center bg-gray-50/50 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          }>
            <Routes>
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
              <Route path="/clients/:id" element={<ProtectedRoute><ClientDetails /></ProtectedRoute>} />
              <Route path="/schedules" element={<ProtectedRoute><Schedules /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/inspections" element={<Inspections />} />
              <Route path="/new" element={<NewInspection />} />
              <Route path="/execute" element={<InspectionExecution />} />
              <Route path="/summary" element={<InspectionSummary />} />
              <Route path="/templates" element={<AdminTemplates />} />
              <Route path="/templates/new" element={<TemplateEditor />} />
              <Route path="/templates/import" element={<SmartImporter />} />
              <Route path="/templates/:id" element={<TemplateDetail />} />
              <Route path="/templates/:id/edit" element={<TemplateEditor />} />
              <Route path="/legislations" element={<LegislationsManager />} />
              <Route path="/access-denied" element={<AccessDenied />} />
            </Routes>
          </Suspense>
        </main>

        <div className="lg:hidden">
          <Routes>
             <Route path="/execute" element={null} />
             <Route path="*" element={<BottomNav />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

async function reconcileCorruptedIds() {
  try {
    const { db } = await import('./db/database');
    const { supabase } = await import('./lib/supabase');
    const { mapFromPostgres } = await import('./services/inspectionService');

    const { data: remoteInspections, error } = await supabase
      .from('inspections')
      .select('*')
      .is('deleted_at', null)
      .in('status', ['in_progress', 'completed']);

    if (error || !remoteInspections?.length) return;

    for (const row of remoteInspections) {
      const existing = await db.inspections.get(row.id);
      if (!existing) {
        // Server has an inspection we don't have locally — import it
        console.log('[App] Reconciling missing inspection from server:', row.id);
        const mapped = mapFromPostgres(row);
        await db.inspections.put({ ...mapped, syncStatus: 'synced' as const, dataVerifiedAt: new Date() });
      }
    }
  } catch (err) {
    console.warn('[App] ID reconciliation failed:', err);
  }
}

export default App;
