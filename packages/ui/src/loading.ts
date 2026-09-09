import { createNotice, removeNotice } from './dom';
import type { Close } from './types';

interface PendingLoading {
  message: string;
}

const pending: PendingLoading[] = [];
let element: HTMLDivElement | undefined;
let label: HTMLSpanElement | undefined;

/** Shows the latest active message until all callers close their own handles. */
export function loading(message = '加载中…'): Close {
  if (!element) {
    element = createNotice('pkg-ui-loading');
    const spinner = document.createElement('span');
    spinner.className = 'pkg-ui-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    label = document.createElement('span');
    element.appendChild(spinner);
    element.appendChild(label);
    document.body.appendChild(element);
  }

  const entry: PendingLoading = { message };
  pending.push(entry);
  label!.textContent = message;

  return () => {
    const index = pending.indexOf(entry);
    if (index === -1) return;
    pending.splice(index, 1);

    const latest = pending[pending.length - 1];
    if (latest) {
      label!.textContent = latest.message;
    } else {
      removeNotice(element!);
      element = undefined;
      label = undefined;
    }
  };
}
