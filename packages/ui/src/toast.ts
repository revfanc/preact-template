import { createNotice, removeNotice } from './dom';
import type { Close, ToastOptions } from './types';

let closeCurrent: Close | undefined;

/** Shows one plain-text toast, replacing the previous toast. */
export function toast(message: string, options: ToastOptions = {}): Close {
  const duration = options.duration ?? 2000;
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError(
      'Toast duration must be a finite, non-negative number.',
    );
  }

  const element = createNotice('pkg-ui-toast');
  element.textContent = message;
  closeCurrent?.();
  document.body.appendChild(element);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const close: Close = () => {
    clearTimeout(timer);
    removeNotice(element);
    if (closeCurrent === close) closeCurrent = undefined;
  };
  closeCurrent = close;
  if (duration > 0) timer = setTimeout(close, duration);
  return close;
}
