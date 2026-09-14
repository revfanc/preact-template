import type { ComponentType } from 'preact';
import { renderToString } from 'preact-render-to-string';
import AgreementLayout from './layouts/agreement';
import stylesheet from './style.css?inline';

const style = `<style id="agreement-style">${stylesheet.replace(/</g, '\\3c ')}</style>`;

const modules = import.meta.glob<{
  default: ComponentType;
  title: string;
}>('./pages/**/index.tsx', { eager: true });

const pages = Object.fromEntries(
  Object.entries(modules).map(([file, page]) => [
    file.replace('./pages', '').replace(/index\.tsx$/, ''),
    page,
  ]),
);

// This module runs only in Node, never in the browser.
export function prerender({ url }: { url: string }) {
  const path = new URL(url, 'http://localhost').pathname.replace(/\/?$/, '/');
  const page = pages[path];
  if (!page) throw new Error(`Unknown agreement page: ${path}`);
  const Page = page.default;
  return {
    html: renderToString(
      <AgreementLayout>
        <Page />
      </AgreementLayout>,
    ),
    head: { title: page.title, elements: new Set([style]) },
    links: new Set(Object.keys(pages)),
  };
}
