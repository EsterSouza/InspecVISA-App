const CHUNK_RECOVERY_KEY = 'inspecvisa:chunk-recovery-reloaded';

export function isChunkLoadFailure(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason || '');
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('Expected a JavaScript-or-Wasm module script')
  );
}

function reloadOnceForFreshBuild(reason: unknown): boolean {
  if (!isChunkLoadFailure(reason)) return false;
  if (sessionStorage.getItem(CHUNK_RECOVERY_KEY) === '1') return true;

  sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1');
  window.location.reload();
  return true;
}

/**
 * Para os `catch` que engolem o erro (o `import()` do gerador de PDF, por
 * exemplo): se a falha for de chunk desatualizado após um deploy, recarrega a
 * página uma vez e devolve `true` — o chamador deve abortar seu próprio aviso de
 * erro, porque o app vai recarregar na build nova. Sem isto, o erro vira só um
 * toast e o recovery global (unhandledrejection) nunca dispara.
 */
export function recoverFromChunkError(reason: unknown): boolean {
  return reloadOnceForFreshBuild(reason);
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
