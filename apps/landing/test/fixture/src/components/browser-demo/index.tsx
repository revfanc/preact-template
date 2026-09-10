import { useBrowserDemo } from '../../hooks/use-browser-demo';
import styles from './index.module.css';

export function BrowserDemo() {
  const demo = useBrowserDemo();
  return (
    <main class={styles.page}>
      <header>
        <p class={styles.eyebrow}>浏览器交互示例</p>
        <h1>返回拦截体验</h1>
        <p>点击“模拟返回”，或使用浏览器返回按钮。每次只执行最上层的回调。</p>
      </header>
      <section class={styles.panel} aria-labelledby="layers-title">
        <h2 id="layers-title">已注册 {demo.layers.length} 层</h2>
        <p class={styles.hint}>添加和移除不同层，观察下一次返回由谁处理。</p>
        {demo.layers.length > 0 ? (
          <ol class={styles.layers}>
            {demo.layers
              .slice()
              .reverse()
              .map((id, index) => (
                <li key={id}>
                  <span>
                    第 {id} 层 {index === 0 && <small>栈顶</small>}
                  </span>
                  <button
                    type="button"
                    disabled={demo.busy}
                    aria-label={`移除第 ${id} 层`}
                    onClick={() => {
                      void demo.remove(id);
                    }}
                  >
                    移除
                  </button>
                </li>
              ))}
          </ol>
        ) : (
          <p class={styles.hint}>当前没有返回拦截。</p>
        )}
        <div class={styles.actions}>
          <button
            type="button"
            class={styles.primary}
            disabled={demo.busy || !demo.layers.length}
            onClick={demo.back}
          >
            模拟返回
          </button>
          <button
            type="button"
            disabled={demo.busy}
            onClick={() => {
              void demo.add();
            }}
          >
            添加一层拦截
          </button>
          <button
            type="button"
            disabled={demo.busy || !demo.layers.length}
            onClick={() => {
              void demo.clear();
            }}
          >
            关闭全部拦截
          </button>
        </div>
        <p class={styles.status} role="status">
          {demo.status}
        </p>
      </section>
      <p class={styles.note}>
        每次完成一层，全部完成后再次返回才离开。刷新页面会重新注册一层。
      </p>
      <button
        type="button"
        disabled={demo.busy}
        onClick={() => {
          void demo.home();
        }}
      >
        返回首页
      </button>
    </main>
  );
}
