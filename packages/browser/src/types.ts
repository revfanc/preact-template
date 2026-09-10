/** Complete and remove this handler after restoration; only the final layer releases to base. */
export type Done = () => Promise<void>;
export type BackHandler = (done: Done) => void | Promise<void>;
/** Remove this registration; safe to call after its done() has completed. */
export type Unregister = () => Promise<void>;

export interface RegisterOptions {
  /** Receives callback and traversal failures. Defaults to console.error. */
  onError?: (error: unknown) => void;
}
