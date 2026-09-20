import { lazy } from 'preact-iso';
import { pages as files } from 'virtual:pages';
import { PageError } from '@/components/page-error';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const routes = files.map(({ load, ...route }) => ({
  ...route,
  path: base + route.path,
  component: lazy(() =>
    load()
      .then((module) => {
        if (typeof module.default !== 'function')
          throw new Error(`Page needs a default component: ${route.file}`);
        return module.default;
      })
      .catch((error) => {
        if (typeof window === 'undefined') throw error;
        console.error(error);
        return PageError;
      }),
  ),
}));
