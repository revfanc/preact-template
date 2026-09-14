import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { normalizePath } from 'vite';
import type { Plugin } from 'vite';
import { createFileRoutes } from './patterns.ts';

const id = 'virtual:file-routes';
const resolvedId = '\0' + id;

export function fileRoutes(): Plugin {
  let directory: string;
  return {
    name: 'vite-plugin-preact-file-routes',
    configResolved(config) {
      directory = path.resolve(config.root, 'src/pages');
    },
    resolveId(source) {
      if (source === id) return resolvedId;
    },
    async load(source) {
      if (source !== resolvedId) return;
      this.addWatchFile(directory);
      const routes = createFileRoutes(
        (await readdir(directory, { recursive: true })).map(normalizePath),
      );
      return `export const routes = [${routes
        .map((route) => {
          const file = normalizePath(path.join(directory, route.file));
          this.addWatchFile(file);
          return `{...${JSON.stringify(route)}, load: () => import(${JSON.stringify('/@fs/' + file)})}`;
        })
        .join(',')}];`;
    },
    configureServer(server) {
      const update = (file: string) => {
        const relative = normalizePath(path.relative(directory, file));
        if (
          relative.startsWith('../') ||
          path.isAbsolute(relative) ||
          !relative.endsWith('index.tsx')
        )
          return;
        const module = server.moduleGraph.getModuleById(resolvedId);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', update).on('unlink', update);
      server.httpServer?.once('close', () => {
        server.watcher.off('add', update).off('unlink', update);
      });
    },
  };
}
