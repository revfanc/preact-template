import { render, type ComponentChildren, type JSX } from 'preact';
import { ModalView } from './view';
import { pushModal, removeModal, isTopModal } from './stack';
import styles from './index.module.css';

export type ModalCancelReason = 'cancel' | 'close' | 'escape' | 'overlay';
export class ModalCancelledError extends Error {
  readonly reason: ModalCancelReason;
  constructor(reason: ModalCancelReason = 'cancel') {
    super(`Modal cancelled: ${reason}`);
    this.name = 'ModalCancelledError';
    this.reason = reason;
  }
}
export interface ModalControls<T> {
  /** Lets the render component coordinate its own exit animation with the overlay. */
  closing: boolean;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}
export interface ModalOptions<T> {
  render: (controls: ModalControls<T>) => ComponentChildren;
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  /** Defaults to false to avoid losing form input. */
  closeOnClickOverlay?: boolean;
  /** Applied only to this modal's overlay. */
  overlayStyle?: JSX.CSSProperties;
}
export type ModalPromise<T> = Promise<T> & { close: () => void };

/** Each call owns one stack entry and settles after its content unmounts. */
export function modal<T = void>(options: ModalOptions<T>): ModalPromise<T> {
  if (typeof document === 'undefined' || !document.body) {
    throw new Error('modal must be called after document.body is ready.');
  }
  const host = document.createElement('div');
  host.className = styles.host!;
  host.setAttribute('data-modal', '');
  host.setAttribute('data-position', options.position ?? 'center');
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  }) as ModalPromise<T>;
  let outcome: { value: T } | { error: unknown } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;
  let closeContent: (() => void) | undefined;

  function cleanup() {
    if (destroyed || !outcome) return;
    destroyed = true;
    clearTimeout(timer);
    let final = outcome;
    try {
      render(null, host);
    } catch (error) {
      final = { error };
    } finally {
      removeModal(entry);
    }
    if ('error' in final) reject(final.error);
    else resolve(final.value);
  }
  function finish(next: NonNullable<typeof outcome>, failed = false) {
    if (destroyed || outcome) return;
    outcome = next;
    entry.closing = true;
    host.classList.add(styles.closing!);
    closeContent?.();
    const reduced = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    timer = setTimeout(cleanup, failed || reduced ? 0 : 160);
  }
  const cancel = (reason: ModalCancelReason) =>
    finish({ error: new ModalCancelledError(reason) });
  const entry = pushModal(host, cancel);
  const controls: ModalControls<T> = {
    closing: false,
    resolve: (value) => finish({ value }),
    reject: (reason) =>
      finish({
        error: reason === undefined ? new ModalCancelledError() : reason,
      }),
  };
  promise.close = () => cancel('close');
  try {
    render(
      <ModalView
        entry={entry}
        options={options}
        controls={controls}
        onReady={(close) => {
          closeContent = close;
          if (entry.closing) close();
        }}
        onOverlay={() => {
          if (isTopModal(entry) && options.closeOnClickOverlay)
            cancel('overlay');
        }}
        onError={(error) => finish({ error }, true)}
      />,
      host,
    );
  } catch (error) {
    finish({ error }, true);
  }
  return promise;
}
