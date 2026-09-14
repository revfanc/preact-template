import { hydrate, prerender as render } from 'preact-iso';
import { App } from './app';
import { getPage, paths } from './routes';
import stylesheet from './style.css?inline';

function mount() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = window.location.pathname.slice(base.length) || '/';
  document.title = getPage(path)?.title || '页面不存在';
  hydrate(<App path={path} />, document.getElementById('app')!);
}

if (typeof window !== 'undefined') {
  if (import.meta.env.DEV) {
    import('./style.css').then(mount);
  } else {
    mount();
  }
}

export async function prerender({ url }: { url: string }) {
  const page = getPage(url);
  if (!page) throw new Error(`Unknown agreement page: ${url}`);
  const { html } = await render(<App path={url} />);
  return {
    html,
    links: new Set(paths),
    head: {
      title: page.title,
      elements: new Set([
        `<style id="agreement-style">${stylesheet.replace(/</g, '\\3c ')}</style>`,
      ]),
    },
  };
}
