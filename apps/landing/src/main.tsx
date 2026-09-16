// preact-iso uses Object.fromEntries, which is newer than our browser targets.
import 'core-js/es/object/from-entries';
import { hydrate } from 'preact-iso';
import { App } from './app';
import './style.css';

if (typeof window !== 'undefined') {
  const root = document.getElementById('app')!;
  const path = location.pathname.replace(/\/$/, '') || '/';
  const initial = root.firstElementChild?.getAttribute('data-page');
  // A host may serve index.html as its fallback instead of the empty 200.html.
  const hydrating =
    initial === path && !!root.querySelector('script[type="isodata"]');
  if (!hydrating) root.textContent = '';
  hydrate(<App hydrating={hydrating} />, root);
}

export async function prerender({ url }: { url: string }) {
  if (url === '/200.html') return { html: '' };
  const { default: render, locationStub } =
    await import('preact-iso/prerender');
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  locationStub(base + url);
  const { html } = await render(<App />);
  // Only explicit build routes are rendered; business links do not expand the crawl.
  return { html, links: new Set(['/200.html']) };
}
