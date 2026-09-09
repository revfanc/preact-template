import { useEffect, useState } from 'preact/hooks';
import type { SiteConfig } from '@packages/api';
import { createBrowserAbortController } from '@packages/request/browser';
import { api } from './api';

export function App() {
  const [config, setConfig] = useState<SiteConfig>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState('');
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const controller = createBrowserAbortController();
    let active = true;
    setError(false);
    api.getConfig(controller.signal).then(
      (value) => {
        if (active) setConfig(value);
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  const agreementBase = import.meta.env.VITE_AGREEMENT_URL;
  const agreementURL = `${agreementBase}${agreementBase.includes('?') ? '&' : '?'}name=${encodeURIComponent(name.trim())}`;

  return (
    <main class="page">
      <header class="masthead">
        <span class="brand-mark" aria-hidden="true">
          J
        </span>
        <span>示例站点</span>
      </header>
      <section class="intro" aria-labelledby="page-title">
        <p class="eyebrow">从这里开始</p>
        <h1 id="page-title">{config?.title ?? '欢迎来到示例站点'}</h1>
        {config ? (
          <p class="description">{config.description}</p>
        ) : (
          <p role={error ? 'alert' : 'status'}>
            {error ? '页面信息加载失败，请重试。' : '正在加载页面信息…'}
          </p>
        )}
        {error && (
          <button
            class="secondary"
            type="button"
            onClick={() => setAttempt(attempt + 1)}
          >
            重新加载
          </button>
        )}
      </section>
      <section class="panel" aria-labelledby="preview-title">
        <h2 id="preview-title">打个招呼</h2>
        <p class="hint">输入一个称呼，预览属于你的欢迎语。</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setGreeting(
              name.trim()
                ? `你好，${name.trim()}。欢迎开启新的体验。`
                : '请输入称呼。',
            );
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
            onInput={(event) => {
              setName(event.currentTarget.value);
              setGreeting('');
            }}
            placeholder="例如：小明"
          />
          <p class="field-note">仅用于本页演示，不会提交或保存。</p>
          <button class="primary" type="submit">
            预览欢迎语 <span aria-hidden="true">→</span>
          </button>
          <p class="greeting" role="status">
            {greeting}
          </p>
        </form>
      </section>
      <footer>
        <a href={agreementURL}>
          阅读示例协议 <span aria-hidden="true">↗</span>
        </a>
        <p>{config?.companyName ?? '示例站点'} · 页面内容仅供演示</p>
      </footer>
    </main>
  );
}
