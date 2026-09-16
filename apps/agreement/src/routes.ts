import { pages as routes } from 'virtual:pages/eager';
import * as notFound from './pages/_404';

export { notFound };

export const paths = routes
  .filter((route) => !route.default)
  .map((route) => (route.path === '/' ? '/' : route.path + '/'));

export function getPage(path: string) {
  const normalized =
    path.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
  return routes.find((route) => route.path === normalized)?.page;
}
