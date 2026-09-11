import { useLayoutEffect, useRef } from 'preact/hooks';
import {
  modal,
  ModalCancelledError,
  toast,
  type ModalPromise,
} from '@packages/feedback';
import { NameModal } from '../components/name-modal';

export function useNameModal(onConfirm: (value: string) => void) {
  const pending = useRef<ModalPromise<string>[]>([]);
  useLayoutEffect(
    () => () => {
      pending.current.forEach((task) => task.close());
    },
    [],
  );
  async function show(
    initial: string,
    nested = true,
  ): Promise<string | undefined> {
    const task = modal<string>({
      position: nested ? 'center' : 'bottom',
      overlayStyle: nested
        ? undefined
        : { backgroundColor: 'rgba(0, 0, 0, 0.25)' },
      render: ({ resolve, reject, closing }) => (
        <NameModal
          closing={closing}
          initial={initial}
          onConfirm={resolve}
          onCancel={() => reject()}
          onNested={nested ? (value) => show(value, false) : undefined}
        />
      ),
    });
    pending.current.push(task);
    try {
      return await task;
    } catch (error) {
      if (!(error instanceof ModalCancelledError)) toast('弹窗暂时无法打开');
    } finally {
      pending.current = pending.current.filter((item) => item !== task);
    }
  }
  return async (initial: string) => {
    const value = await show(initial);
    if (value !== undefined) onConfirm(value);
  };
}
