import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ModalControls } from './types';
import { refreshModalFocus } from './stack';
import styles from './async.module.css';

export interface AsyncModalErrorControls<T> extends ModalControls<T> {
  error: unknown;
  retry: () => void;
}

export interface AsyncModalContentProps<T, Module> {
  controls: ModalControls<T>;
  /** Captured on mount; retries call this same loader. */
  load: () => Promise<Module>;
  render: (module: Module, controls: ModalControls<T>) => ComponentChildren;
  loading?: ComponentChildren;
  renderError?: (controls: AsyncModalErrorControls<T>) => ComponentChildren;
  /** Positive finite milliseconds, defaults to 15000. Does not abort import(). */
  timeout?: number;
}

export class ModalLoadTimeoutError extends Error {
  constructor() {
    super('Modal content loading timed out');
    this.name = 'ModalLoadTimeoutError';
  }
}

type State<Module> =
  | { status: 'loading' }
  | { status: 'ready'; module: Module }
  | { status: 'error'; error: unknown };

/** Owns resource loading only; the parent modal owns the result and overlay. */
export function AsyncModalContent<T, Module>({
  controls,
  load,
  render,
  loading,
  renderError,
  timeout = 15000,
}: AsyncModalContentProps<T, Module>) {
  if (!Number.isFinite(timeout) || timeout <= 0)
    throw new Error('AsyncModalContent timeout must be positive and finite.');
  const source = useRef({ load, timeout });
  const root = useRef<HTMLDivElement>(null);
  const current = useRef(controls);
  current.current = controls;
  const run = useRef({ generation: 0, pending: false, stopped: false });
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [state, setState] = useState<State<Module>>({ status: 'loading' });
  // Preserve the committed content for its exit animation. A late load must
  // never introduce new content during the modal's closing render.
  const visible = useRef(state);
  if (!controls.closing) visible.current = state;

  function stop() {
    run.current.stopped = true;
    run.current.generation++;
    clearTimeout(timer.current);
  }
  function start() {
    const attempt = run.current;
    if (attempt.stopped || attempt.pending || current.current.closing) return;
    attempt.pending = true;
    const generation = ++attempt.generation;
    setState({ status: 'loading' });
    function finish(next: State<Module>) {
      if (
        attempt.stopped ||
        generation !== attempt.generation ||
        current.current.closing
      )
        return;
      clearTimeout(timer.current);
      attempt.pending = false;
      // Timeout also invalidates the import that is still running.
      attempt.generation++;
      setState(next);
    }
    timer.current = setTimeout(
      () => finish({ status: 'error', error: new ModalLoadTimeoutError() }),
      source.current.timeout,
    );
    try {
      Promise.resolve(source.current.load()).then(
        (module) => finish({ status: 'ready', module }),
        (error) => finish({ status: 'error', error }),
      );
    } catch (error) {
      finish({ status: 'error', error });
    }
  }
  useLayoutEffect(() => {
    if (!current.current.closing) start();
    return stop;
  }, []);
  useLayoutEffect(() => {
    if (controls.closing) stop();
    else if (root.current) refreshModalFocus(root.current);
  }, [state, controls.closing]);

  const view = visible.current;
  let content: ComponentChildren;
  if (view.status === 'ready') content = render(view.module, controls);
  else if (view.status === 'error' && renderError)
    content = renderError({ ...controls, error: view.error, retry: start });
  else if (view.status === 'loading' && loading !== undefined)
    content = loading;
  else {
    const failed = view.status === 'error';
    const message = failed
      ? view.error instanceof ModalLoadTimeoutError
        ? '加载超时，请重试'
        : '加载失败，请重试'
      : '正在加载…';
    content = (
      <div
        class={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="弹窗内容加载"
      >
        {!failed && (
          <span class={styles.dots} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
        <p role={failed ? 'alert' : 'status'}>{message}</p>
        <div class={styles.actions}>
          <button type="button" onClick={() => controls.reject()}>
            {failed ? '关闭' : '取消'}
          </button>
          {failed && (
            <button type="button" class={styles.retry} onClick={start}>
              重试
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div
      ref={root}
      class={`no-rem ${controls.closing ? styles.closing : ''}`}
      data-modal-async={view.status}
    >
      {content}
    </div>
  );
}
