import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import styles from './index.module.css';

interface Props {
  closing: boolean;
  initial: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  onNested?: (value: string) => Promise<string | undefined>;
}
export function NameModal({
  initial,
  onConfirm,
  onCancel,
  onNested,
  closing,
}: Props) {
  const [name, setName] = useState(initial);
  const [entered, setEntered] = useState(false);
  const card = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    // Establish the starting style before transitioning to the visible state.
    void card.current?.offsetWidth;
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <section
      ref={card}
      class={styles.card}
      data-visible={entered && !closing}
      role="dialog"
      aria-modal="true"
      aria-label={onNested ? '填写称呼' : '另一层弹窗'}
    >
      <h2>{onNested ? '填写称呼' : '另一层弹窗'}</h2>
      <p>确认后将称呼返回上一层，取消则保留原来的内容。</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) onConfirm(name.trim());
        }}
      >
        <label>
          弹窗中的称呼
          <input
            value={name}
            maxLength={40}
            required
            onInput={(event) => setName(event.currentTarget.value)}
          />
        </label>
        {onNested && (
          <button
            class={styles.link}
            type="button"
            onClick={async () => {
              const value = await onNested(name);
              if (value !== undefined) setName(value);
            }}
          >
            再打开一层
          </button>
        )}
        <div class={styles.actions}>
          <button type="button" onClick={onCancel}>
            取消
          </button>
          <button class={styles.primary} type="submit">
            确认称呼
          </button>
        </div>
      </form>
    </section>
  );
}
