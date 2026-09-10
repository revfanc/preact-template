import styles from './index.module.css';
import { useRoute } from 'preact-iso';

export default function DetailPage() {
  const { params } = useRoute();
  return (
    <main class={styles.page}>
      <section class={styles.intro}>
        <p class={styles.eyebrow}>内容详情</p>
        <h1>详情示例</h1>
        <p class={styles.description}>内容编号：{params.id}</p>
        <p>
          <a href={import.meta.env.BASE_URL}>回到首页</a>
        </p>
      </section>
    </main>
  );
}
