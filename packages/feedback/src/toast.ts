import { showToast } from './notice';
import type { Close, ToastOptions } from './types';

/** Shows one plain-text toast, replacing any current notice. */
export function toast(message: string, options: ToastOptions = {}): Close {
  const duration = options.duration ?? 2000;
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError(
      'Toast duration must be a finite, non-negative number.',
    );
  }

  return showToast(message, duration);
}
