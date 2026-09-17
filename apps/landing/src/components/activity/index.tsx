import styles from './index.module.css';

export function Activity() {
  return (
    <main class={styles.page}>
      <header class={styles.header}>
        <span>生活提案</span>
        <span>VOL. 01</span>
      </header>
      <section class={styles.hero} aria-labelledby="activity-title">
        <p class={styles.eyebrow}>给平凡的一天，一点新意</p>
        <h1 id="activity-title">
          慢下来，
          <br />
          发现生活的小美好。
        </h1>
        <p class={styles.description}>
          一杯咖啡，一段散步，一次期待已久的出发。
          <br />
          从今天开始，留一点时间给自己。
        </p>
        <a class={styles.button} href="#ideas">
          看看今日灵感 <span aria-hidden="true">↓</span>
        </a>
      </section>
      <section id="ideas" class={styles.ideas} aria-labelledby="ideas-title">
        <h2 id="ideas-title">今天，可以这样开始</h2>
        <ol class={styles.list}>
          <li>
            <span>01</span>
            <div>
              <h3>走一条新的路</h3>
              <p>换个方向，看看沿途未曾留意的风景。</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>享受片刻留白</h3>
              <p>放下手机，让心情跟着阳光慢下来。</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>记录一个好瞬间</h3>
              <p>把今天的小确幸，留给未来的自己。</p>
            </div>
          </li>
        </ol>
      </section>
      <footer class={styles.footer}>
        <span>美好，不必等到明天。</span>
      </footer>
    </main>
  );
}
