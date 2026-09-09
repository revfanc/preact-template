/** Safe to call more than once; only closes the notice created by this call. */
export type Close = () => void;

export interface ToastOptions {
  /** Milliseconds until dismissal. Defaults to 2000; 0 keeps the toast visible. */
  duration?: number;
}
