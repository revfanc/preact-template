import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import styles from './index.module.css';

interface Props {
  layer: number;
  closing: boolean;
  resolve: (allow: boolean) => void;
}

export function BackConfirm({ layer, closing, resolve }: Props) {
  const card = useRef<HTMLElement>(null);
  const [entered, setEntered] = useState(false);
  useLayoutEffect(() => {
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
      aria-label={`第 ${layer} 层拦截`}
    >
      <p class={styles.eyebrow}>检测到返回操作</p>
      <h2>第 {layer} 层拦截</h2>
      <p>
        完成后移除当前层，下次返回处理下一层。全部完成后，再次返回才会离开。
      </p>
      <div class={styles.actions}>
        <button type="button" onClick={() => resolve(false)}>
          留在页面
        </button>
        <button
          type="button"
          class={styles.primary}
          onClick={() => resolve(true)}
        >
          完成当前层
        </button>
      </div>
    </section>
  );
}
