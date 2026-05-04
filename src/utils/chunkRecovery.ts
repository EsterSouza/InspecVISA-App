const CHUNK_RECOVERY_KEY = 'inspecvisa:chunk-recovery-reloaded';

function isChunkLoadFailure(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason || '');
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('Expected a JavaScript-or-Wasm module script')
  );
}

function reloadOnceForFreshBuild(reason: unknown) {
  if (!isChunkLoadFailure(reason)) return;
  if (sessionStorage.getItem(CHUNK_RECOVERY_KEY) === '1') return;

  sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1');
  window.location.reload();
}

export function installChunkRecovery() {
  window.addEventListener('load', () => {
    sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
  });

  window.addEventListener('unhandledrejection', (event) => {
    reloadOnceForFreshBuild(event.reason);
  });

  window.addEventListener('error', (event) => {
    reloadOnceForFreshBuild(event.error || event.message);
  });
}
