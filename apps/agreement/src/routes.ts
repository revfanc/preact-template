import type { ComponentType } from 'preact';

const pages = import.meta.glob<{ default: ComponentType; title: string }>(
  './pages/**/index.tsx',
  { eager: true },
);

export const paths = Object.keys(pages).map((file) =>
  file.replace('./pages', '').replace(/index\.tsx$/, ''),
);

export function getPage(path: string) {
  const normalized = path.replace(/index\.html$/, '').replace(/\/?$/, '/');
  return pages[`./pages${normalized}index.tsx`];
}
