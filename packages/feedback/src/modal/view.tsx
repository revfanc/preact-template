import {
  useErrorBoundary,
  useLayoutEffect,
  useRef,
  useState,
} from 'preact/hooks';
import type { ModalControls, ModalOptions } from './types';
import { activateModal, type ModalEntry } from './stack';
import styles from './index.module.css';

function Content<T>({
  options,
  controls,
}: {
  options: ModalOptions<T>;
  controls: ModalControls<T>;
}) {
  return <>{options.render(controls)}</>;
}
export function ModalView<T>({
  entry,
  options,
  controls,
  onReady,
  onOverlay,
  onError,
}: {
  entry: ModalEntry;
  options: ModalOptions<T>;
  controls: ModalControls<T>;
  onReady: (close: () => void) => void;
  onOverlay: () => void;
  onError: (error: unknown) => void;
}) {
  const [error] = useErrorBoundary(onError);
  const [closing, setClosing] = useState(false);
  const touch = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const consume = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  useLayoutEffect(() => {
    onReady(() => setClosing(true));
    activateModal(entry);
  }, []);
  if (error) return null;
  return (
    <>
      <div
        class={styles.overlay}
        data-modal-overlay
        style={options.overlayStyle}
        aria-hidden="true"
        onClick={(event) => {
          consume(event);
          onOverlay();
        }}
        onMouseDown={consume}
        onMouseUp={consume}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onWheel={consume}
        onTouchStart={(event) => {
          // Cancel the synthetic click as well, even if the modal closes before touchend.
          consume(event);
          const point = event.touches[0];
          touch.current = point
            ? {
                x: point.clientX,
                y: point.clientY,
                moved: event.touches.length !== 1,
              }
            : null;
        }}
        onTouchMove={(event) => {
          consume(event);
          const point = event.touches?.[0];
          if (
            point &&
            touch.current &&
            (Math.abs(point.clientX - touch.current.x) > 10 ||
              Math.abs(point.clientY - touch.current.y) > 10)
          )
            touch.current.moved = true;
        }}
        onTouchEnd={(event) => {
          consume(event);
          const tap = touch.current && !touch.current.moved;
          touch.current = null;
          if (tap) onOverlay();
        }}
        onTouchCancel={(event) => {
          consume(event);
          touch.current = null;
        }}
      />
      <div class={styles.content} data-modal-content tabIndex={-1}>
        <Content options={options} controls={{ ...controls, closing }} />
      </div>
    </>
  );
}
