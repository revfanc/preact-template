import type { FileRoute, PageFile, RouteOptions } from './types.ts';

/** Pure filename-to-route parsing, validation and deterministic precedence. */
export function resolveRoutes(
  pages: PageFile[],
  options: Pick<RouteOptions, 'index' | 'dynamic'> = {},
): FileRoute[] {
  const seen = new Map<string, string>();
  const routes: FileRoute[] = [];
  for (const page of pages) {
    const { file } = page;
    if (page.default) {
      routes.push({ file, default: true });
      continue;
    }
    const segments = page.stem.split('/');
    if (segments[segments.length - 1] === (options.index ?? 'index'))
      segments.pop();
    const params = new Set<string>();
    const pattern = segments.map((segment, position) => {
      const parameter = /^\[(\.\.\.)?([A-Za-z_][A-Za-z0-9_]*)\]$/.exec(segment);
      if (!parameter) {
        if (!/^[\p{L}\p{N}_-]+$/u.test(segment))
          throw new Error(`Invalid route segment "${segment}" in ${file}`);
        return segment;
      }
      if (options.dynamic === false)
        throw new Error(
          `Dynamic routes require concrete prerender paths: ${file}`,
        );
      const [, catchAll, name] = parameter;
      if (params.has(name!))
        throw new Error(`Repeated parameter "${name}" in ${file}`);
      if (catchAll && position !== segments.length - 1)
        throw new Error(`Catch-all must be the final segment: ${file}`);
      params.add(name!);
      return `:${name}${catchAll ? '+' : ''}`;
    });
    const path = '/' + pattern.join('/');
    const signature = path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':');
    const previous = seen.get(signature);
    if (previous)
      throw new Error(`Conflicting page routes: ${previous} and ${file}`);
    seen.set(signature, file);
    routes.push({ file, path });
  }
  return routes.sort(compareRoutes);
}

function compareRoutes(a: FileRoute, b: FileRoute): number {
  if (a.default || b.default) return Number(!!a.default) - Number(!!b.default);
  const left = a.path.split('/');
  const right = b.path.split('/');
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = priority(right[i]) - priority(left[i]);
    if (difference) return difference;
  }
  return a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
}

function priority(segment?: string) {
  if (segment === undefined) return 4;
  if (!segment.startsWith(':')) return 3;
  return segment.endsWith('+') ? 1 : 2;
}
