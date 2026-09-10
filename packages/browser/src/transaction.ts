export function failure(name: 'AbortError' | 'TimeoutError', message: string) {
  const error = new Error(message);
  error.name = name;
  return error;
}

export function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {
    promise,
    settled: false,
    resolve() {
      if (this.settled) return;
      this.settled = true;
      resolve();
    },
    reject(error: unknown) {
      if (this.settled) return;
      this.settled = true;
      reject(error);
    },
  };
}
export type Completion = ReturnType<typeof deferred>;
