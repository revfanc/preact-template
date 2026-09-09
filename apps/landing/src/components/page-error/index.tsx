import styles from './index.module.css';

export function PageError() {
  return (
    <main class={styles.page} role="alert">
      <section class={styles.content}>
        <div class={styles.illustration} aria-hidden="true">
          <svg viewBox="0 0 80 80" fill="none" focusable="false">
            <path
              d="M23 12h23l12 12v42H23a5 5 0 0 1-5-5V17a5 5 0 0 1 5-5Z"
              fill="#fff"
              stroke="currentColor"
              stroke-width="2"
              stroke-linejoin="round"
            />
            <path
              d="M46 12v14h12M29 36h17M29 44h10"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle cx="57" cy="58" r="15" fill="#166348" />
            <path
              d="M57 50v9"
              stroke="#fff"
              stroke-width="2.5"
              stroke-linecap="round"
            />
            <circle cx="57" cy="64" r="1.5" fill="#fff" />
          </svg>
        </div>
        <h1>页面加载失败</h1>
        <p>
          页面暂时没有打开。
          <br />
          请检查网络连接后再试一次。
        </p>
        <button class={styles.retry} onClick={() => window.location.reload()}>
          重新加载页面
        </button>
      </section>
    </main>
  );
}
