import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { initializeDatabase } from './db/database';
import { getTemplates } from './data/templates';
import { useSettingsStore } from './store/useSettingsStore';
import { useAuthStore } from './store/useAuthStore';
import type { AuthState } from './store/useAuthStore';
import { Loader2 } from 'lucide-react';

// Layout
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';

// Lazy Loaded Pages
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Clients = lazy(() => import('./pages/Clients').then(m => ({ default: m.Clients })));
const ClientDetails = lazy(() => import('./pages/ClientDetails').then(m => ({ default: m.ClientDetails })));
const Schedules = lazy(() => import('./pages/Schedules').then(m => ({ default: m.Schedules })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const SyncCenter = lazy(() => import('./pages/SyncCenter').then(m => ({ default: m.SyncCenter })));
const Inspections = lazy(() => import('./pages/Inspections').then(m => ({ default: m.Inspections })));
const NewInspection = lazy(() => import('./pages/NewInspection').then(m => ({ default: m.NewInspection })));
const InspectionExecution = lazy(() => import('./pages/InspectionExecution').then(m => ({ default: m.InspectionExecution })));
const InspectionSummary = lazy(() => import('./pages/InspectionSummary').then(m => ({ default: m.InspectionSummary })));
const AccessDenied = lazy(() => import('./pages/AccessDenied').then(m => ({ default: m.AccessDenied })));

const AdminTemplates = lazy(() => import('./pages/admin/AdminTemplates').then(m => ({ default: m.AdminTemplates })));
const SmartImporter = lazy(() => import('./pages/admin/SmartImporter').then(m => ({ default: m.SmartImporter })));
const LegislationsManager = lazy(() => import('./pages/admin/LegislationsManager').then(m => ({ default: m.LegislationsManager })));
const TemplateDetail = lazy(() => import('./pages/TemplateDetail').then(m => ({ default: m.TemplateDetail })));
const TemplateEditor = lazy(() => import('./pages/admin/TemplateEditor').then(m => ({ default: m.TemplateEditor })));

// Public portal pages (no auth required)
const PublicSchedule = lazy(() => import('./pages/PublicSchedule').then(m => ({ default: m.PublicSchedule })));
const PublicAppointmentStatus = lazy(() => import('./pages/PublicAppointmentStatus').then(m => ({ default: m.PublicAppointmentStatus })));
const ClientPortal = lazy(() => import('./pages/ClientPortal').then(m => ({ default: m.ClientPortal })));

import { ProtectedRoute } from './components/ProtectedRoute';
import { ProfileSelection } from './pages/ProfileSelection';
import { Login } from './pages/Login';
import { SettingsService } from './services/settingsService';

const BOOT_DB_TIMEOUT_MS = 8000;
const TEMPLATE_SYNC_DELAY_MS = 6000;
const CLIENT_REPAIR_DELAY_MS = 9000;
const SYNC_START_DELAY_MS = 1200;
const REMOTE_RECONCILE_DELAY_MS = 12000;

type SyncQueueModule = typeof import('./services/syncQueueService');
let syncQueueModulePromise: Promise<SyncQueueModule> | null = null;
let syncQueueModule: SyncQueueModule | null = null;

function loadSyncQueueModule() {
  syncQueueModulePromise ??= import('./services/syncQueueService').then((module) => {
    syncQueueModule = module;
    return module;
  });
  return syncQueueModulePromise;
}

function RouteFallback() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center bg-gray-50/50 backdrop-blur-sm">
      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
    </div>
  );
}

function LoginRoute() {
  const auth = useAuthStore() as AuthState;
  if (auth.user) return <Navigate to="/" replace />;
  return <Login />;
}

interface InternalAppProps {
  isInitializing: boolean;
}

/**
 * Internal (authenticated) area of the app. Keeps the original layout,
 * boot loading gate and profile selection flow intact.
 */
function InternalApp({ isInitializing }: InternalAppProps) {
  const auth = useAuthStore() as AuthState;
  const user = auth.user;
  const initialized = auth.initialized;
  const name = useSettingsStore((s) => s.settings.name);

  if (!initialized || isInitializing) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary-600 mb-4" />
        <p className="text-gray-500 font-medium">Conectando ao InspecVISA...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!name) return <ProfileSelection />;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans text-gray-900 antialiased">
      <div className="hidden lg:block">
         <Routes>
           <Route path="/execute" element={null} />
           <Route path="*" element={<Sidebar />} />
         </Routes>
      </div>

      <main className="flex-1 overflow-y-auto w-full relative pb-24 lg:pb-0">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
            <Route path="/clients/:id" element={<ProtectedRoute><ClientDetails /></ProtectedRoute>} />
            <Route path="/schedules" element={<ProtectedRoute><Schedules /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/inspections" element={<ProtectedRoute><Inspections /></ProtectedRoute>} />
            <Route path="/new" element={<ProtectedRoute><NewInspection /></ProtectedRoute>} />
            <Route path="/execute" element={<ProtectedRoute><InspectionExecution /></ProtectedRoute>} />
            <Route path="/summary" element={<ProtectedRoute><InspectionSummary /></ProtectedRoute>} />
            <Route path="/templates" element={<ProtectedRoute><AdminTemplates /></ProtectedRoute>} />
            <Route path="/templates/new" element={<ProtectedRoute><TemplateEditor /></ProtectedRoute>} />
            <Route path="/templates/import" element={<ProtectedRoute><SmartImporter /></ProtectedRoute>} />
            <Route path="/templates/:id" element={<ProtectedRoute><TemplateDetail /></ProtectedRoute>} />
            <Route path="/templates/:id/edit" element={<ProtectedRoute><TemplateEditor /></ProtectedRoute>} />
            <Route path="/legislations" element={<ProtectedRoute><LegislationsManager /></ProtectedRoute>} />
            <Route path="/sync" element={<ProtectedRoute><SyncCenter /></ProtectedRoute>} />
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
  );
}

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const theme = useSettingsStore((s) => s.settings.theme);

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
      await useAuthStore.getState().initialize();
      const currentUser = useAuthStore.getState().user;
      if (currentUser && navigator.onLine) {
        void SettingsService.load()
          .then((remoteSettings) => {
            if (remoteSettings?.name) {
              useSettingsStore.getState().replaceSettings(remoteSettings);
            }
          })
          .catch((err) => console.warn('[App] Remote settings load failed:', err));
      }
      void useAuthStore.getState().checkSession().then((isAuthorized) => {
        if (!isAuthorized && useAuthStore.getState().user) {
          console.warn('[App] Session check failed, user state cleared');
        }
      }).catch((err) => {
        console.warn('[App] Session check failed in background:', err);
      });

      console.log('🚀 Iniciando InspecVISA Step 2/4: Database...');
      // Step 2: Load static templates immediately into Dexie (offline-safe)
      try {
        const staticTemplates = getTemplates();
        const dbPromise = initializeDatabase(staticTemplates);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), BOOT_DB_TIMEOUT_MS));
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
        window.setTimeout(() => {
          if (didCancel || !navigator.onLine) return;
          import('./services/templateService').then(async ({ TemplateService }) => {
            try {
              const { SyncQueueService } = await loadSyncQueueModule();
              const queue = await SyncQueueService.getQueueSummary();
              const operationalBacklog = queue.pending + queue.syncing + queue.failed + queue.conflict;
              if (operationalBacklog > 0) {
                console.log(`[App] Skipping background template sync while ${operationalBacklog} operational items are queued.`);
                return;
              }

              const remoteTemplates = await TemplateService.syncAllTemplatesToDexie();
              if (remoteTemplates?.length) {
                await initializeDatabase([...getTemplates(), ...remoteTemplates]);
              }
            } catch (tErr) {
              console.warn('[App] Remote templates fetch failed (non-fatal):', tErr);
            }
          }).catch(() => {});
        }, TEMPLATE_SYNC_DELAY_MS);

        // One-time repair: restore clients incorrectly soft-deleted by a previous bug
        window.setTimeout(() => {
          void (async () => {
            if (didCancel || !navigator.onLine) return;
            try {
              const { ClientService } = await import('./services/clientService');
              await ClientService.restoreSoftDeletedClientsFromRemote();
            } catch { /* non-fatal */ }
          })();
        }, CLIENT_REPAIR_DELAY_MS);
      }
    };

    const startBackgroundServices = async () => {
      try {
        const { SyncQueueService } = await loadSyncQueueModule();
        await SyncQueueService.cleanupStuckSyncing();

        window.setTimeout(() => {
          if (didCancel) return;
          try {
            SyncQueueService.start();
          } catch (err) {
            console.error('[App] Sync start error:', err);
          }
        }, SYNC_START_DELAY_MS);

        window.setTimeout(() => {
          if (didCancel || !navigator.onLine) return;
          void reconcileCorruptedIds();
        }, REMOTE_RECONCILE_DELAY_MS);
      } catch (err) {
        console.error('[App] Post-init sync error:', err);
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
    }).finally(() => {
      clearTimeout(safetyTimer);
      void startBackgroundServices();
    });

    // Warning before leaving with pending items
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (syncQueueModule?.SyncQueueService.hasPending()) {
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
  }, []);

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

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — no authentication required */}
        <Route
          path="/agendar"
          element={
            <Suspense fallback={<RouteFallback />}>
              <PublicSchedule />
            </Suspense>
          }
        />
        <Route
          path="/portal/:token"
          element={
            <Suspense fallback={<RouteFallback />}>
              <PublicAppointmentStatus />
            </Suspense>
          }
        />
        <Route
          path="/cliente"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ClientPortal />
            </Suspense>
          }
        />
        <Route path="/login" element={<LoginRoute />} />

        {/* Internal (protected) area */}
        <Route path="*" element={<InternalApp isInitializing={isInitializing} />} />
      </Routes>
    </BrowserRouter>
  );
}

async function reconcileCorruptedIds() {
  try {
    const { InspectionService } = await import('./services/inspectionService');
    await InspectionService.importMissingRemoteInspections();
  } catch (err) {
    console.warn('[App] ID reconciliation failed:', err);
  }
}

export default App;
