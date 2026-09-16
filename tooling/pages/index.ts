import { glob } from 'node:fs/promises';
import path from 'node:path';
import { normalizePath } from 'vite';
import type { Plugin } from 'vite';

export type PageEntry = { file: string } & (
  { path: string; default?: false } | { path?: never; default: true }
);

type PagesOptions = {
  directory?: string;
  pattern?: string;
  eager?: boolean;
  staticOnly?: boolean;
};

export function pages({
  directory = 'src/pages',
  pattern = '**/*.{tsx,jsx}',
  eager = false,
  staticOnly = false,
}: PagesOptions = {}): Plugin {
  const name = eager ? 'virtual:pages/eager' : 'virtual:pages';
  const internal = '\0' + name;
  let folder: string;
  let dispose: (() => void) | undefined;
  const selected = (file: string) =>
    path.matchesGlob(file, pattern) &&
    (!file.split('/').some((part) => part.startsWith('_')) ||
      /^_404(?:\/index)?\.[^.]+$/.test(file));

  return {
    name: 'pages',
    configResolved(config) {
      folder = path.resolve(config.root, directory);
    },
    resolveId(id) {
      if (id === name) return internal;
    },
    async load(id) {
      if (id !== internal) return;
      this.addWatchFile(folder);
      const list: string[] = [];
      for await (const entry of glob(pattern, {
        cwd: folder,
        withFileTypes: true,
      })) {
        const file = normalizePath(
          path.relative(folder, path.join(entry.parentPath, entry.name)),
        );
        if (entry.isFile() && selected(file)) list.push(file);
      }
      const imports: string[] = [];
      const rows = manifest(list, staticOnly).map((page, i) => {
        const filename = normalizePath(path.resolve(folder, page.file));
        this.addWatchFile(filename);
        const url = JSON.stringify('/@fs/' + filename);
        if (eager) imports.push(`import * as p${i} from ${url};`);
        return `{...${JSON.stringify(page)}, ${eager ? `page: p${i}` : `load: () => import(${url})`}}`;
      });
      return `${imports.join('\n')}\nexport const pages = [${rows.join(',')}];`;
    },
    configureServer(server) {
      server.watcher.add(folder);
      const refresh = (filename: string) => {
        const file = normalizePath(path.relative(folder, filename));
        if (file.startsWith('../') || path.isAbsolute(file) || !selected(file))
          return;
        const module = server.moduleGraph.getModuleById(internal);
        if (!module) return;
        server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refresh).on('unlink', refresh);
      dispose = () => {
        server.watcher.off('add', refresh).off('unlink', refresh);
      };
    },
    closeBundle() {
      dispose?.();
    },
  };
}

function manifest(files: string[], staticOnly: boolean): PageEntry[] {
  const used = new Map<string, string>();
  const entries = files.sort().map((file): PageEntry => {
    const segments = file.slice(0, -path.extname(file).length).split('/');
    if (segments[segments.length - 1] === 'index') segments.pop();
    const fallback = segments.length === 1 && segments[0] === '_404';
    const parameters = new Set<string>();
    const url =
      '/' +
      segments
        .map((segment, i) => {
          const match = /^\[(\.\.\.)?([A-Za-z_][A-Za-z0-9_]*)\]$/.exec(segment);
          if (!match) {
            if (!/^[A-Za-z0-9_-]+$/.test(segment))
              throw new Error(`Invalid page name: ${file}`);
            return segment;
          }
          const [, catchAll, parameter] = match;
          if (staticOnly)
            throw new Error(`Static pages cannot contain parameters: ${file}`);
          if (parameters.has(parameter!))
            throw new Error(`Duplicate parameter: ${file}`);
          if (catchAll && i !== segments.length - 1)
            throw new Error(`Catch-all must be last: ${file}`);
          parameters.add(parameter!);
          return `:${parameter}${catchAll ? '+' : ''}`;
        })
        .join('/');
    const key = fallback
      ? '<404>'
      : url.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':');
    if (used.has(key))
      throw new Error(`Conflicting pages: ${used.get(key)} and ${file}`);
    used.set(key, file);
    return fallback ? { file, default: true } : { file, path: url };
  });
  // Exact paths precede parameters and catch-alls; fallback is always last.
  const priority = (part?: string) => {
    if (!part) return 4;
    if (!part.startsWith(':')) return 3;
    return part.endsWith('+') ? 1 : 2;
  };
  return entries.sort((a, b) => {
    if (a.default || b.default)
      return Number(!!a.default) - Number(!!b.default);
    const left = a.path.split('/'),
      right = b.path.split('/');
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      const difference = priority(right[i]) - priority(left[i]);
      if (difference) return difference;
    }
    return 0;
  });
}
