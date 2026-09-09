import type { ModalCancelReason } from './index';
import styles from './index.module.css';

export interface ModalEntry {
  host: HTMLDivElement;
  cancel: (reason: ModalCancelReason) => void;
  focus: HTMLElement | null;
  closing: boolean;
}
const stack: ModalEntry[] = [];
let container: HTMLDivElement | undefined;
let restorePage: (() => void) | undefined;
let origin: Element | null = null;

function top() {
  return stack[stack.length - 1];
}
export function isTopModal(entry: ModalEntry) {
  return top() === entry;
}
function content(entry: ModalEntry) {
  return entry.host.querySelector<HTMLElement>('[data-modal-content]');
}
function focusable(entry: ModalEntry) {
  return Array.from(
    entry.host.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a[href], [tabindex]',
    ),
  ).filter(
    (node) =>
      node.tabIndex >= 0 &&
      !node.matches(':disabled') &&
      node.getClientRects().length > 0,
  );
}
function focusEntry(entry: ModalEntry) {
  const target = entry.focus;
  if (
    target &&
    entry.host.contains(target) &&
    !target.matches(':disabled') &&
    target.getClientRects().length
  )
    target.focus();
  else (focusable(entry)[0] ?? content(entry))?.focus();
}
function sync() {
  stack.forEach((entry, index) => {
    const active = isTopModal(entry);
    entry.host.style.zIndex = String(index + 1);
    entry.host.classList.toggle(styles.inactive!, !active);
    if (active) entry.host.removeAttribute('aria-hidden');
    else if (!entry.host.contains(document.activeElement))
      entry.host.setAttribute('aria-hidden', 'true');
  });
}
function focusin(event: FocusEvent) {
  const entry = top();
  if (!entry) return;
  if (entry.host.contains(event.target as Node))
    entry.focus = event.target as HTMLElement;
  else focusEntry(entry);
}
function blockBackground(event: Event) {
  const entry = top();
  if (entry && (entry.closing || !entry.host.contains(event.target as Node))) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}
function keydown(event: KeyboardEvent) {
  const entry = top();
  if (!entry || event.defaultPrevented) return;
  if (event.key === 'Escape' || event.key === 'Esc') {
    event.preventDefault();
    event.stopImmediatePropagation();
    entry.cancel('escape');
  } else if (event.key === 'Tab') {
    const nodes = focusable(entry);
    const first = nodes[0],
      last = nodes[nodes.length - 1];
    const current = document.activeElement;
    if (
      !first ||
      (event.shiftKey && (current === first || current === content(entry)))
    ) {
      event.preventDefault();
      (last ?? content(entry))?.focus();
    } else if (
      !event.shiftKey &&
      (current === last || current === content(entry))
    ) {
      event.preventDefault();
      first.focus();
    }
  }
}
function lockPage() {
  origin = document.activeElement;
  const body = document.body;
  const x = window.scrollX,
    y = window.scrollY;
  const properties = [
    'position',
    'top',
    'left',
    'width',
    'overflow',
    'padding-right',
    'box-sizing',
  ];
  const saved = properties.map((name) => ({
    name,
    value: body.style.getPropertyValue(name),
    priority: body.style.getPropertyPriority(name),
  }));
  const gap = Math.max(
    0,
    window.innerWidth - document.documentElement.clientWidth,
  );
  const padding = parseFloat(getComputedStyle(body).paddingRight) || 0;
  body.style.position = 'fixed';
  body.style.top = `${-y}px`;
  body.style.left = `${-x}px`;
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  body.style.boxSizing = 'border-box';
  if (gap) body.style.paddingRight = `${padding + gap}px`;
  document.addEventListener('focusin', focusin, true);
  document.addEventListener('keydown', keydown);
  document.addEventListener('click', blockBackground, true);
  document.addEventListener('submit', blockBackground, true);
  restorePage = () => {
    document.removeEventListener('focusin', focusin, true);
    document.removeEventListener('keydown', keydown);
    document.removeEventListener('click', blockBackground, true);
    document.removeEventListener('submit', blockBackground, true);
    for (const { name, value, priority } of saved) {
      if (value) body.style.setProperty(name, value, priority);
      else body.style.removeProperty(name);
    }
    if (
      origin instanceof HTMLElement &&
      document.documentElement.contains(origin)
    )
      origin.focus();
    origin = null;
    window.scrollTo(x, y);
  };
}
export function pushModal(
  host: HTMLDivElement,
  cancel: ModalEntry['cancel'],
): ModalEntry {
  const previous = top();
  if (previous && previous.host.contains(document.activeElement))
    previous.focus = document.activeElement as HTMLElement;
  if (!container) {
    container = document.createElement('div');
    container.className = styles.root!;
    container.setAttribute('data-modal-root', '');
    lockPage();
    document.body.appendChild(container);
  }
  const entry: ModalEntry = { host, cancel, focus: null, closing: false };
  stack.push(entry);
  container.appendChild(host);
  sync();
  return entry;
}
export function activateModal(entry: ModalEntry) {
  if (!isTopModal(entry)) return;
  if (!entry.host.contains(document.activeElement)) focusEntry(entry);
  sync();
}
export function removeModal(entry: ModalEntry) {
  const index = stack.indexOf(entry);
  if (index < 0) return;
  const wasTop = isTopModal(entry);
  stack.splice(index, 1);
  entry.host.parentNode?.removeChild(entry.host);
  sync();
  if (stack.length === 0) {
    container?.parentNode?.removeChild(container);
    container = undefined;
    const restore = restorePage;
    restorePage = undefined;
    restore?.();
  } else if (wasTop) focusEntry(top()!);
}
