// preact-iso uses Object.fromEntries, which is newer than our browser targets.
import 'core-js/es/object/from-entries';
import { hydrate } from 'preact-iso';
import { prerenderPaths } from 'virtual:pages';
import { App } from './app';
import './styles/index.css';

if (typeof window !== 'undefined') {
  const root = document.getElementById('app')!;
  const path = location.pathname.replace(/\/$/, '') || '/';
  const initial = root.firstElementChild?.getAttribute('data-page');
  // Only hydrate matching static HTML; the SPA fallback has an empty root.
  const hydrating =
    initial === path && !!root.querySelector('script[type="isodata"]');
  if (!hydrating) root.textContent = '';
  hydrate(<App hydrating={hydrating} />, root);
}

export async function prerender({ url }: { url: string }) {
  const links = new Set(prerenderPaths);
  if (url === '/') return { html: '', links };

  const { default: render, locationStub } =
    await import('preact-iso/prerender');
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  locationStub(base + url);
  const { html } = await render(<App />);
  // The build plugin collects page opt-ins; business links do not expand the crawl.
  return { html, links };
}
