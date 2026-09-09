import type { ComponentChildren, JSX } from 'preact';

export type ModalCancelReason = 'cancel' | 'close' | 'escape' | 'overlay';

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
