import { createNotice, removeNotice } from './dom';
import type { Close } from './types';

type Notice = { kind: 'loading' | 'toast'; message: string };
const SHOW_DELAY = 120;
const MIN_LOADING_TIME = 240;
const FADE_TIME = 140;
const RESIZE_TIME = 180;

let current: Notice | undefined;
let element: HTMLDivElement | undefined;
let content: HTMLDivElement | undefined;
let spinner: HTMLSpanElement | undefined;
let label: HTMLSpanElement | undefined;
let shownAt = 0;
let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let removeTimer: ReturnType<typeof setTimeout> | undefined;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let resizeTimer: ReturnType<typeof setTimeout> | undefined;
const pending: Notice[] = [];

function cancelTimers() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  clearTimeout(removeTimer);
  clearTimeout(toastTimer);
}

function render() {
  if (!current) return;
  const previous = element?.getBoundingClientRect();
  clearTimeout(resizeTimer);
  if (!element) {
    element = createNotice('pkg-ui-notice');
    content = document.createElement('div');
    content.className = 'pkg-ui-content';
    spinner = document.createElement('span');
    spinner.className = 'pkg-ui-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    label = document.createElement('span');
    label.className = 'pkg-ui-label';
    content.appendChild(spinner);
    content.appendChild(label);
    element.appendChild(content);
    document.body.appendChild(element);
    shownAt = Date.now();
  }
  // Measure natural size without interrupting an opacity transition.
  element.style.transitionProperty = 'opacity';
  resetSize();
  element.classList.remove('pkg-ui-loading', 'pkg-ui-toast');
  element.classList.add(`pkg-ui-${current.kind}`);
  spinner!.hidden = current.kind !== 'loading';
  label!.textContent = current.message;
  const next = element.getBoundingClientRect();
  if (
    previous &&
    (previous.width !== next.width || previous.height !== next.height)
  ) {
    // Keep line breaks steady while the surrounding card changes size.
    content!.style.width = `${content!.getBoundingClientRect().width}px`;
    content!.style.maxWidth = 'none';
    element.style.width = `${previous.width}px`;
    element.style.height = `${previous.height}px`;
    void element.offsetWidth;
    element.style.transitionProperty = '';
    element.style.width = `${next.width}px`;
    element.style.height = `${next.height}px`;
    resizeTimer = setTimeout(resetSize, RESIZE_TIME + 40);
  } else {
    void element.offsetWidth;
    element.style.transitionProperty = '';
  }
  element.classList.add('pkg-ui-visible');
}

function resetSize() {
  if (!element || !content) return;
  element.style.width = '';
  element.style.height = '';
  content.style.width = '';
  content.style.maxWidth = '';
}

function dismiss(kind: Notice['kind']) {
  current = undefined;
  cancelTimers();
  if (!element) return;
  const fadeOut = () => {
    element!.classList.remove('pkg-ui-visible');
    removeTimer = setTimeout(() => {
      clearTimeout(resizeTimer);
      removeNotice(element!);
      element = undefined;
      content = undefined;
      spinner = undefined;
      label = undefined;
    }, FADE_TIME);
  };
  const remaining =
    kind === 'loading'
      ? Math.max(0, MIN_LOADING_TIME - (Date.now() - shownAt))
      : 0;
  if (remaining) hideTimer = setTimeout(fadeOut, remaining);
  else fadeOut();
}

function assertBody() {
  if (typeof document === 'undefined' || !document.body) {
    throw new Error(
      '@packages/ui must be called after document.body is ready.',
    );
  }
}

export function showLoading(message: string): Close {
  assertBody();
  const entry: Notice = { kind: 'loading', message };
  const continuing = current?.kind === 'loading';
  if (!continuing) {
    cancelTimers();
    pending.length = 0;
  }
  pending.push(entry);
  current = entry;
  if (element) render();
  else if (!continuing) showTimer = setTimeout(render, SHOW_DELAY);

  return () => {
    const index = pending.indexOf(entry);
    if (index === -1) return;
    pending.splice(index, 1);
    current = pending[pending.length - 1];
    if (!current) dismiss('loading');
    else if (element) render();
  };
}

export function showToast(message: string, duration: number): Close {
  assertBody();
  cancelTimers();
  pending.length = 0;
  const entry: Notice = { kind: 'toast', message };
  current = entry;
  render();
  const close = () => {
    if (current === entry) dismiss('toast');
  };
  if (duration > 0) toastTimer = setTimeout(close, duration);
  return close;
}
