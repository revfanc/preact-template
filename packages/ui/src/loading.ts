import { showLoading } from './notice';
import type { Close, LoadingOptions } from './types';

/** Concurrent loading handles share one notice; a toast replaces the entire group. */
export function loading(options: string | LoadingOptions = {}): Close {
  return showLoading(
    typeof options === 'string' ? { message: options } : options,
  );
}
