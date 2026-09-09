import styles from './index.module.css';
export function PageLoadError() {
  return (
    <main class={styles.page} role="alert">
      <section class={styles.intro}>
        <h1>页面加载失败</h1>
        <p>请检查网络后重新加载。</p>
        <button
          class={styles.secondary}
          onClick={() => window.location.reload()}
        >
          重新加载页面
        </button>
      </section>
    </main>
  );
}
