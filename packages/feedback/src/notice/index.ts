import './style.css';
import { showLoading, showToast } from './runtime';
import type { Close, LoadingOptions, ToastOptions } from './types';

/** Concurrent loading handles share one notice; a toast replaces the entire group. */
export function loading(options: string | LoadingOptions = {}): Close {
  return showLoading(
    typeof options === 'string' ? { message: options } : options,
  );
}

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
