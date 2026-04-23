import { supabase } from '../lib/supabase';
import { syncClientsOnly, syncSchedulesOnly, syncInspectionsOnly } from './syncService';

// Control flags to prevent infinite loops (debouncing)
let syncTimeoutId: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_DELAY = 2500; // 2.5 seconds wait before syncing to avoid rapid-fire updates

// Keep track of active channels
let globalChannel: ReturnType<typeof supabase.channel> | null = null;

/**
 * Initializes Supabase Realtime listeners for the tenant.
 * Uses a "Pull-Only" architecture: when an event arrives from the server,
 * it just triggers the specific local sync function after a debounce.
 * It NEVER pushes data in response to a Realtime event (prevents loops).
 */
export function startRealtimeSync() {
  if (globalChannel) {
    console.log('🔄 Realtime channel already active. Skipping initialization.');
    return;
  }

  // We don't filter by tenant_id in the channel setup here because RLS handles the security.
  // The client will only receive events for rows they are allowed to see.
  globalChannel = supabase
    .channel('tenant_data')
    // Listen to changes in Clients
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'clients' },
      () => queueSync('clients')
    )
    // Listen to changes in Inspections
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'inspections' },
      () => queueSync('inspections')
    )
    // Listen to changes in Schedules
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'schedules' },
      () => queueSync('schedules')
    )
    .subscribe((status) => {
      console.log(`📡 Realtime Status: ${status}`);
    });
}

/**
 * Stops the realtime listeners (useful on logout)
 */
export function stopRealtimeSync() {
  if (globalChannel) {
    supabase.removeChannel(globalChannel);
    globalChannel = null;
    console.log('🛑 Realtime channel disconnected.');
  }
}

/**
 * Queues a sync operation using a debounce mechanism.
 * If 5 changes happen in 2 seconds, it only syncs once at the end.
 */
function queueSync(entity: 'clients' | 'inspections' | 'schedules') {
  if (syncTimeoutId) {
    clearTimeout(syncTimeoutId);
  }

  // We are currently ignoring the specific entity to debounce EVERYTHING together,
  // but we map it to call specific functions if needed later.
  syncTimeoutId = setTimeout(() => {
    executeRealtimeSync(entity);
  }, DEBOUNCE_DELAY);
}

/**
 * Executes the actual pull operation based on the entity that changed.
 * NOTE: We only call the *Only syncs to avoid full sync overhead.
 */
async function executeRealtimeSync(entity: string) {
  // Prevent firing if a global sync is already running
  if ((window as any).isSyncingGlobally) return;
  
  console.log(`⚡ Realtime event triggered sync for: ${entity}`);
  
  try {
    switch (entity) {
      case 'clients':
        await syncClientsOnly();
        break;
      case 'inspections':
        await syncInspectionsOnly();
        break;
      case 'schedules':
        await syncSchedulesOnly();
        break;
      default:
        // Fallback for safety
        break;
    }
  } catch (err) {
    console.error(`❌ Realtime sync failed for ${entity}:`, err);
  }
}
