import { hydrate, prerender as render } from 'preact-iso';
import { App } from './app';
import { getPage, paths } from './routes';
import * as notFound from './components/not-found';
import stylesheet from './style.css?inline';

function mount() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = window.location.pathname.slice(base.length) || '/';
  const { default: Page, title } = getPage(path) ?? notFound;
  document.title = title;
  hydrate(
    <App>
      <Page />
    </App>,
    document.getElementById('app')!,
  );
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
  const { default: Page, title } = page;
  const { html } = await render(
    <App>
      <Page />
    </App>,
  );
  return {
    html,
    links: new Set(paths),
    head: {
      title,
      elements: new Set([
        `<style id="agreement-style">${stylesheet.replace(/</g, '\\3c ')}</style>`,
      ]),
    },
  };
}
