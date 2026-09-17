import { glob, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { normalizePath } from 'vite';
import type { Plugin } from 'vite';

export type PageEntry = { file: string; path: string };

type PagesOptions = {
  directory?: string;
  pattern?: string;
  exclude?: string | string[];
  eager?: boolean;
  staticOnly?: boolean;
};

export function pages({
  directory = 'src/pages',
  pattern = '**/*.{tsx,jsx}',
  exclude = [],
  eager = false,
  staticOnly = false,
}: PagesOptions = {}): Plugin {
  const name = eager ? 'virtual:pages/eager' : 'virtual:pages';
  const internal = '\0' + name;
  let root: string;
  let folder: string;
  let dispose: (() => void) | undefined;
  const excluded = Array.isArray(exclude) ? exclude : [exclude];
  const isPageFile = (filename: string) => {
    const file = normalizePath(path.relative(folder, filename));
    const rootRelative = normalizePath(path.relative(root, filename));
    return (
      !file.startsWith('../') &&
      !path.isAbsolute(file) &&
      path.matchesGlob(file, pattern) &&
      !excluded.some((glob) => path.matchesGlob(rootRelative, glob))
    );
  };

  return {
    name: 'pages',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
      folder = path.resolve(root, directory);
    },
    resolveId(id) {
      if (id === name) return internal;
    },
    transform(code, id) {
      if (!isPageFile(id)) return;
      const metadata = prerenderDeclaration(id, code);
      if (!metadata) return;
      // Reserve the prerender export for the render entry; preserve source positions.
      return {
        code:
          code.slice(0, metadata.start) +
          ' '.repeat(metadata.end - metadata.start) +
          code.slice(metadata.end),
        map: null,
      };
    },
    async load(id) {
      if (id !== internal) return;
      const list: string[] = [];
      for await (const entry of glob(pattern, {
        cwd: folder,
        withFileTypes: true,
      })) {
        const file = normalizePath(
          path.relative(folder, path.join(entry.parentPath, entry.name)),
        );
        if (entry.isFile() && isPageFile(path.resolve(folder, file)))
          list.push(file);
      }
      const imports: string[] = [];
      const routes = manifest(list, staticOnly);
      const sources = await Promise.all(
        routes.map((page) => readFile(path.resolve(folder, page.file), 'utf8')),
      );
      const prerenderPaths: string[] = [];
      const rows = routes.map((page, i) => {
        const filename = normalizePath(path.resolve(folder, page.file));
        this.addWatchFile(filename);
        if (prerenderDeclaration(page.file, sources[i]!)?.enabled) {
          if (page.path.includes(':'))
            throw new Error(
              `Prerender requires a concrete page path: ${page.file}`,
            );
          prerenderPaths.push(page.path);
        }
        const url = JSON.stringify('/@fs/' + filename);
        if (eager) imports.push(`import * as p${i} from ${url};`);
        return `{...${JSON.stringify(page)}, ${eager ? `page: p${i}` : `load: () => import(${url})`}}`;
      });
      return `${imports.join('\n')}\nexport const pages = [${rows.join(',')}];\nexport const prerenderPaths = ${JSON.stringify(prerenderPaths)};`;
    },
    configureServer(server) {
      server.watcher.add(folder);
      const refresh = (event: string, filename: string) => {
        if (
          !['add', 'change', 'unlink'].includes(event) ||
          !isPageFile(filename)
        )
          return;
        const module = server.moduleGraph.getModuleById(internal);
        if (!module) return;
        server.moduleGraph.invalidateModule(module);
        if (event !== 'change') server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('all', refresh);
      dispose = () => {
        server.watcher.off('all', refresh);
      };
    },
    closeBundle() {
      dispose?.();
    },
  };
}

function prerenderDeclaration(file: string, source: string) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest);
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const exported = statement.modifiers?.find(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;
    const { declarations, flags } = statement.declarationList;
    const declaration = declarations.find(
      ({ name }) => ts.isIdentifier(name) && name.text === 'prerender',
    );
    if (!declaration) continue;
    const kind = declaration.initializer?.kind;
    if (
      !(flags & ts.NodeFlags.Const) ||
      declarations.length !== 1 ||
      (kind !== ts.SyntaxKind.TrueKeyword &&
        kind !== ts.SyntaxKind.FalseKeyword)
    )
      throw new Error(
        `Use a standalone export const prerender = true or false: ${file}`,
      );
    return {
      enabled: kind === ts.SyntaxKind.TrueKeyword,
      start: exported.getStart(ast),
      end: exported.end,
    };
  }
}

// Supported subset of https://uvr.esm.is/guide/file-based-routing.
// Only emitted path syntax depends on preact-iso (catch-all uses :name*).
function manifest(files: string[], staticOnly: boolean): PageEntry[] {
  const used = new Map<string, string>();
  const entries = files.sort().map((file) => {
    const stem = file.slice(0, -path.extname(file).length);
    const segments = stem.split('/');
    if (segments[segments.length - 1] === 'index') segments.pop();
    else if (files.some((other) => other.startsWith(stem + '/')))
      throw new Error(`Nested layouts are not supported: ${file}`);
    const parameters = new Set<string>();
    const route =
      '/' +
      segments
        .map((segment, index) => {
          if (/^[A-Za-z0-9_-]+$/.test(segment)) return segment;
          const required = /^\[([A-Za-z_]\w*)\]$/.exec(segment);
          const optional = /^\[\[([A-Za-z_]\w*)\]\]$/.exec(segment);
          const catchAll = /^\[\.\.\.([A-Za-z_]\w*)\]$/.exec(segment);
          const name = required?.[1] ?? optional?.[1] ?? catchAll?.[1];
          if (!name) throw new Error(`Unsupported page segment: ${file}`);
          if (staticOnly)
            throw new Error(`Static pages cannot contain parameters: ${file}`);
          if (parameters.has(name))
            throw new Error(`Duplicate parameter: ${file}`);
          if ((optional || catchAll) && index !== segments.length - 1)
            throw new Error(
              `Optional and catch-all parameters must be last: ${file}`,
            );
          parameters.add(name);
          return `:${name}${optional ? '?' : catchAll ? '*' : ''}`;
        })
        .join('/');
    const key = route.replace(/:[A-Za-z_]\w*/g, ':');
    if (used.has(key))
      throw new Error(`Conflicting pages: ${used.get(key)} and ${file}`);
    used.set(key, file);
    return { file, path: route };
  });
  // Exact end, static, required, optional, catch-all.
  const priority = (segment?: string) => {
    if (!segment) return 5;
    if (!segment.startsWith(':')) return 4;
    if (segment.endsWith('*')) return 1;
    return segment.endsWith('?') ? 2 : 3;
  };
  return entries.sort((a, b) => {
    const left = a.path.split('/'),
      right = b.path.split('/');
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      const difference = priority(right[i]) - priority(left[i]);
      if (difference) return difference;
    }
    return 0;
  });
}
