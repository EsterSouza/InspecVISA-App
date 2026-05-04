/**
 * Wraps a Promise or Supabase Builder with a timeout.
 * If the input has an `.abortSignal()` method (Supabase PostgrestBuilder / StorageBuilder),
 * attaches an AbortController so the underlying HTTP request is actually cancelled — not
 * just abandoned. This prevents "zombie" connections from saturating the connection pool.
 */
export async function withTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  ms: number = 15000,
  context: string = 'Network'
): Promise<T> {
  const controller = new AbortController();

  // Attach AbortSignal to Supabase builders before they fire their fetch
  const effective: PromiseLike<T> =
    typeof (promise as any).abortSignal === 'function'
      ? (promise as any).abortSignal(controller.signal)
      : promise;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => {
      controller.abort();
      reject(new Error(`TIMEOUT: ${context} took longer than ${ms}ms`));
    }, ms)
  );

  return Promise.race([
    Promise.resolve(effective).catch((err) => {
      // AbortError means we aborted it ourselves — surface as a timeout error
      if (controller.signal.aborted) {
        throw new Error(`TIMEOUT: ${context} took longer than ${ms}ms`);
      }
      throw err;
    }),
    timeoutPromise,
  ]);
}
