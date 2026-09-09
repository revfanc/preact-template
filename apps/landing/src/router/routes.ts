import type { ComponentType } from 'preact';
import { lazy } from 'preact-iso';
import { createFileRoutes, type FileRoute } from './file-routes';
import { PageLoadError } from '../components/page-load-error';

type PageModule = { default: ComponentType };
const pages = {
  ...import.meta.glob<PageModule>([
    '../pages/**/index.tsx',
    '!../pages/**/_*/**',
  ]),
  ...import.meta.glob<PageModule>('../pages/_404/index.tsx'),
};
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const routes = createFileRoutes(
  Object.keys(pages).map((file) => file.slice('../pages/'.length)),
).map((route) => {
  const scoped: FileRoute = route.default
    ? route
    : { ...route, path: base + route.path };
  return {
    ...scoped,
    component: lazy(() =>
      pages[`../pages/${route.file}`]!()
        .then((module) => {
          if (typeof module.default !== 'function')
            throw new Error(`Page needs a default component: ${route.file}`);
          return module.default;
        })
        .catch(() => PageLoadError),
    ),
  };
});
