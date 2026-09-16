import path from 'node:path';
import { normalizePath } from 'vite';
import type { Plugin } from 'vite';
import { createPageFiles } from './files.ts';
import { generateModule } from './generate.ts';
import { resolveRoutes } from './resolve.ts';
import type { FileRoutesOptions } from './types.ts';

export type { FileRoute, FileRoutesOptions } from './types.ts';

export function fileRoutes(options: FileRoutesOptions = {}): Plugin {
  const files = createPageFiles(options);
  const publicId =
    options.importMode === 'eager'
      ? 'virtual:file-routes/eager'
      : 'virtual:file-routes';
  const moduleId = '\0' + publicId;
  let directory: string;
  let stopWatching: (() => void) | undefined;

  return {
    name: 'file-routes',
    configResolved({ root }) {
      directory = path.resolve(root, options.dir ?? 'src/pages');
    },
    resolveId(id) {
      if (id === publicId) return moduleId;
    },
    async load(id) {
      if (id !== moduleId) return;
      this.addWatchFile(directory);
      const routes = resolveRoutes(await files.scan(directory), options);
      for (const route of routes)
        this.addWatchFile(path.resolve(directory, route.file));
      return generateModule(routes, directory, options.importMode);
    },
    configureServer(server) {
      server.watcher.add(directory);
      function update(file: string) {
        const relative = normalizePath(path.relative(directory, file));
        if (
          relative.startsWith('../') ||
          path.isAbsolute(relative) ||
          !files.match(relative)
        )
          return;
        const module = server.moduleGraph.getModuleById(moduleId);
        if (!module) return;
        server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      }
      server.watcher.on('add', update).on('unlink', update);
      stopWatching = () => {
        server.watcher.off('add', update).off('unlink', update);
      };
    },
    closeBundle() {
      stopWatching?.();
    },
  };
}
