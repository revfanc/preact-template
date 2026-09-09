import styles from './index.module.css';
import { useLocation } from 'preact-iso';

export default function ResultPage() {
  const { query, route } = useLocation();
  const name = query.name?.trim().slice(0, 40) || '访客';
  return (
    <main class={styles.page}>
      <section class={styles.intro}>
        <p class={styles.eyebrow}>欢迎你</p>
        <h1>欢迎语结果</h1>
        <p class={styles.description}>你好，{name}。欢迎开启新的体验。</p>
      </section>
      <section class={styles.panel}>
        <h2>继续探索</h2>
        <p>
          <a href={`${import.meta.env.BASE_URL}detail/1`}>查看详情示例</a>
        </p>
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
