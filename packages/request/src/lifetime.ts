/** One deadline per call, including retries and reading the response body. */
export function createLifetime(
  controller: AbortController,
  toError: (cause: Error) => Error,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let source: AbortSignal | null | undefined;
  let error: Error | undefined;
  let started = false;
  let reject!: (error: Error) => void;
  const cancelled = new Promise<never>((_resolve, fail) => {
    reject = fail;
  });

  function cancel(name: 'AbortError' | 'TimeoutError') {
    if (error) return;
    const cause = new Error(
      name === 'TimeoutError' ? 'Request timed out' : 'Request aborted',
    );
    cause.name = name;
    error = toError(cause);
    // Keep the public error stable even when the legacy controller loses abort reasons.
    reject(error);
    controller.abort();
  }
  const abort = () => cancel('AbortError');

  return {
    signal: controller.signal,
    cancelled,
    check() {
      if (error) throw error;
    },
    start(signal: AbortSignal | null | undefined, timeout = 0) {
      if (started) return;
      if (!Number.isFinite(timeout) || timeout < 0)
        throw new RangeError('timeout 必须是大于或等于 0 的有限数值');
      started = true;
      source = signal;
      if (source?.aborted) {
        abort();
        return;
      }
      source?.addEventListener('abort', abort);
      if (timeout > 0)
        timer = setTimeout(() => cancel('TimeoutError'), timeout);
    },
    dispose() {
      if (timer !== undefined) clearTimeout(timer);
      source?.removeEventListener('abort', abort);
    },
  };
}
