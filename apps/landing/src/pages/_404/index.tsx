import styles from './index.module.css';
import { useLocation } from 'preact-iso';

export default function NotFoundPage() {
  const { route } = useLocation();
  return (
    <main class={styles.page}>
      <section class={styles.intro}>
        <p class={styles.eyebrow}>404</p>
        <h1>页面不存在</h1>
        <p>链接可能已失效，请返回首页继续浏览。</p>
        <button
          class={styles.secondary}
          onClick={() => route(import.meta.env.BASE_URL, true)}
        >
          返回首页
        </button>
      </section>
    </main>
  );
}
