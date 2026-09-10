export type Done = () => Promise<void>;
export type BackHandler = (done: Done) => void | Promise<void>;
export type Unregister = () => Promise<void>;

export interface RegisterOptions {
  /** Receives callback and traversal failures. Defaults to console.error. */
  onError?: (error: unknown) => void;
}
