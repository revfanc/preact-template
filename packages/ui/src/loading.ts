import { showLoading } from './notice';
import type { Close } from './types';

/** Concurrent loading handles share one notice; a toast replaces the entire group. */
export function loading(message = '加载中…'): Close {
  return showLoading(message);
}
