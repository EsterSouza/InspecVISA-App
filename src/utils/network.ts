/**
 * Wraps a Promise or Supabase Builder with a timeout.
 * If the input has an `.abortSignal()` method (Supabase PostgrestBuilder),
 * attaches an AbortController so the underlying HTTP request is actually
 * cancelled, not just abandoned.
 */
/**
 * O que o builder do PostgREST tem a mais que uma Promise comum: um jeito de
 * cancelar a requisição de verdade. O tipo não é exportado pelo supabase-js, e
 * por isso é reconhecido aqui pelo próprio método.
 */
type Cancelavel<T> = PromiseLike<T> & { abortSignal(signal: AbortSignal): PromiseLike<T> };

function podeCancelar<T>(promise: PromiseLike<T>): promise is Cancelavel<T> {
  return typeof (promise as Cancelavel<T>).abortSignal === 'function';
}

export async function withTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  ms: number = 15000,
  context: string = 'Network'
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const effective: PromiseLike<T> = podeCancelar(promise)
    ? promise.abortSignal(controller.signal)
    : promise;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`TIMEOUT: ${context} took longer than ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([
      Promise.resolve(effective).catch((err) => {
        if (controller.signal.aborted) {
          throw new Error(`TIMEOUT: ${context} took longer than ${ms}ms`);
        }
        throw err;
      }),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
