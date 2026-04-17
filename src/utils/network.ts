/**
 * Wraps a Promise or a Supabase Builder (PromiseLike) with a timeout.
 * Prevents infinite hangs on poor network conditions.
 */
export async function withTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  ms: number = 15000,
  context: string = 'Network'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`TIMEOUT: ${context} took longer than ${ms}ms`)), ms)
  );

  return Promise.race([
    Promise.resolve(promise),
    timeoutPromise,
  ]);
}
