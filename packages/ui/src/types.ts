/** Safe to call more than once; replaced handles do not close a newer notice. */
export type Close = () => void;

export interface ToastOptions {
  /** Milliseconds before fade-out starts. Defaults to 2000; 0 keeps the toast visible. */
  duration?: number;
}
