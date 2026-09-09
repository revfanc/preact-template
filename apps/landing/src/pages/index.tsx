import { useNameModal } from '../hooks/use-name-modal';
import styles from './index.module.css';
import { useSiteConfig } from '../hooks/use-site-config';
import { useGreeting } from '../hooks/use-greeting';

export default function HomePage() {
  const { config, error, reload } = useSiteConfig();
  const { name, greeting, updateName, preview } = useGreeting();
  const openNameModal = useNameModal(updateName);

  const agreementBase = import.meta.env.VITE_AGREEMENT_URL;
  const agreementURL = `${agreementBase}${agreementBase.includes('?') ? '&' : '?'}name=${encodeURIComponent(name.trim())}`;

  return (
    <main class={styles.page}>
      <header class={styles.masthead}>
        <span class={styles['brand-mark']} aria-hidden="true">
          J
        </span>
        <span>示例站点</span>
      </header>
      <section class={styles.intro} aria-labelledby="page-title">
        <p class={styles.eyebrow}>从这里开始</p>
        <h1 id="page-title">{config?.title ?? '欢迎来到示例站点'}</h1>
        {config ? (
          <p class={styles.description}>{config.description}</p>
        ) : (
          <p role={error ? 'alert' : 'status'}>
            {error ? '页面信息加载失败，请重试。' : '正在加载页面信息…'}
          </p>
        )}
        {error && (
          <button class={styles.secondary} type="button" onClick={reload}>
            重新加载
          </button>
        )}
      </section>
      <section class={styles.panel} aria-labelledby="preview-title">
        <h2 id="preview-title">打个招呼</h2>
        <p class={styles.hint}>输入一个称呼，预览属于你的欢迎语。</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            preview();
          }}
        >
          <label for="name">你的称呼</label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="off"
            maxLength={40}
            required
            value={name}
            onInput={(event) => updateName(event.currentTarget.value)}
            placeholder="例如：小明"
          />
          <p class={styles['field-note']}>仅用于本页演示，不会提交或保存。</p>
          <button class={styles.primary} type="submit">
            预览欢迎语 <span aria-hidden="true">→</span>
          </button>
          <p class={styles['route-link']}>
            <button
              class={styles.secondary}
              type="button"
              onClick={() => {
                void openNameModal(name);
              }}
            >
              在弹窗中填写
            </button>
          </p>
          <p class={styles.greeting} role="status">
            {greeting}
          </p>
          <p class={styles['route-link']}>
            <a
              href={`${import.meta.env.BASE_URL}result?name=${encodeURIComponent(name.trim())}`}
            >
              <span>查看结果页</span>
            </a>
          </p>
        </form>
      </section>
      <footer>
        <a href={agreementURL} onClick={(event) => event.stopPropagation()}>
          阅读示例协议 <span aria-hidden="true">↗</span>
        </a>
        <p>{config?.companyName ?? '示例站点'} · 页面内容仅供演示</p>
      </footer>
    </main>
  );
}
