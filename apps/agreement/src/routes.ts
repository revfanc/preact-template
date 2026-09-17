import { pages as routes } from 'virtual:pages/eager';

export const paths = routes.map((route) =>
  route.path === '/' ? '/' : route.path + '/',
);

export function getPage(path: string) {
  const normalized =
    path.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
  return routes.find((route) => route.path === normalized)?.page;
}
