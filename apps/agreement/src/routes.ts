import { routes } from 'virtual:file-routes/eager';

export const NotFound = routes.find((route) => route.default)?.page.default;

export const paths = routes.flatMap((route) =>
  route.default ? [] : [route.path === '/' ? '/' : route.path + '/'],
);

export function getPage(path: string) {
  const normalized =
    path.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
  return routes.find((route) => route.path === normalized)?.page;
}
