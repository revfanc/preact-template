import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { register, type Unregister } from '@packages/browser';
import {
  modal,
  ModalCancelledError,
  type ModalPromise,
} from '@packages/feedback/modal';
import { BackConfirm } from '../components/back-confirm';

type Layer = { id: number; unregister: Unregister };
const isAbort = (error: unknown) =>
  error instanceof Error && error.name === 'AbortError';

export function useBrowserDemo() {
  const { route } = useLocation();
  const entries = useRef<Layer[]>([]);
  const counter = useRef(0);
  const mounted = useRef(false);
  const epoch = useRef(0);
  const locked = useRef(false);
  const dialog = useRef<ModalPromise<boolean>>();
  const [layers, setLayers] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('已开启返回拦截，可以开始体验。');

  function publish() {
    if (mounted.current) setLayers(entries.current.map((entry) => entry.id));
  }
  function report(error: unknown) {
    if (isAbort(error)) return;
    console.error(error);
    if (mounted.current) setStatus('本次操作未完成，请关闭全部拦截后重试。');
  }
  function createLayer(id: number) {
    const unregister = register(
      async (done) => {
        const current = epoch.current;
        locked.current = true;
        setBusy(true);
        const task = modal<boolean>({
          render: ({ resolve, closing }) => (
            <BackConfirm layer={id} closing={closing} resolve={resolve} />
          ),
        });
        dialog.current = task;
        try {
          const allow = await task;
          if (!mounted.current || epoch.current !== current) return;
          if (allow) await done();
          if (mounted.current && epoch.current === current) {
            setStatus(
              allow
                ? '已放行本次返回，仍停留本页；再次返回将离开。'
                : `第 ${id} 层保留了本次返回。`,
            );
          }
        } catch (error) {
          if (error instanceof ModalCancelledError) {
            if (mounted.current && epoch.current === current)
              setStatus(`第 ${id} 层保留了本次返回。`);
          } else if (!isAbort(error)) throw error;
        } finally {
          if (dialog.current === task) dialog.current = undefined;
          if (mounted.current && epoch.current === current) {
            locked.current = false;
            setBusy(false);
          }
        }
      },
      { onError: report },
    );
    entries.current.push({ id, unregister });
    publish();
  }
  async function disposeLayers() {
    const previous = entries.current.splice(0).reverse();
    publish();
    await Promise.all(previous.map((entry) => entry.unregister()));
  }
  async function run(operation: () => void | Promise<void>) {
    if (locked.current) return;
    const current = epoch.current;
    locked.current = true;
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      report(error);
    } finally {
      if (mounted.current && epoch.current === current) {
        locked.current = false;
        setBusy(false);
      }
    }
  }

  useLayoutEffect(() => {
    mounted.current = true;
    try {
      createLayer(++counter.current);
    } catch (error) {
      report(error);
    }
    const hide = () => {
      epoch.current++;
      dialog.current?.close();
    };
    const show = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      epoch.current++;
      const ids = entries.current.map((entry) => entry.id);
      entries.current = [];
      locked.current = false;
      setBusy(false);
      try {
        ids.forEach(createLayer);
      } catch (error) {
        report(error);
      }
      publish();
    };
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    return () => {
      mounted.current = false;
      epoch.current++;
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
      dialog.current?.close();
      void disposeLayers().catch(report);
    };
  }, []);

  return {
    layers,
    busy,
    status,
    add: () =>
      run(() => {
        createLayer(++counter.current);
        setStatus('已添加一层；下一次返回将执行新的栈顶回调。');
      }),
    remove: (id: number) =>
      run(async () => {
        const index = entries.current.findIndex((entry) => entry.id === id);
        if (index < 0) return;
        const [entry] = entries.current.splice(index, 1);
        publish();
        await entry!.unregister();
        setStatus(`已移除第 ${id} 层。`);
      }),
    clear: () =>
      run(async () => {
        await disposeLayers();
        setStatus('已关闭全部拦截。');
      }),
    back: () => {
      if (!locked.current && entries.current.length) history.back();
    },
    home: () =>
      run(async () => {
        await disposeLayers();
        if (mounted.current) route(import.meta.env.BASE_URL);
      }),
  };
}
