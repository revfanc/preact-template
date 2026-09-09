export type FileRoute = { file: string } & (
  { path: string; default?: false } | { path?: never; default: true }
);

/** Converts paths relative to pages/ into ordered preact-iso route patterns. */
export function createFileRoutes(files: string[]): FileRoute[] {
  const seen: Record<string, string> = Object.create(null);
  const routes: FileRoute[] = [];
  for (const file of files) {
    if (file !== 'index.tsx' && !file.endsWith('/index.tsx')) continue;
    if (file === '_404/index.tsx') {
      routes.push({ file, default: true });
      continue;
    }
    const segments = file.slice(0, -4).split('/');
    if (segments.some((segment) => segment.startsWith('_'))) continue;
    if (segments[segments.length - 1] === 'index') segments.pop();
    const params: string[] = [];
    const path =
      '/' +
      segments
        .map((segment, index) => {
          const dynamic = /^\[(\.\.\.)?([A-Za-z_][A-Za-z0-9_]*)\]$/.exec(
            segment,
          );
          if (dynamic) {
            const name = dynamic[2]!;
            if (params.indexOf(name) !== -1)
              throw new Error(`Repeated route parameter in ${file}: ${name}`);
            params.push(name);
            if (dynamic[1] && index !== segments.length - 1) {
              throw new Error(
                `Catch-all must be the final route segment: ${file}`,
              );
            }
            return `:${name}${dynamic[1] ? '+' : ''}`;
          }
          if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
            throw new Error(`Unsupported route segment in ${file}: ${segment}`);
          }
          return segment;
        })
        .join('/');
    const signature = path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':');
    const conflict = seen[signature];
    if (conflict)
      throw new Error(`Conflicting page routes: ${conflict} and ${file}`);
    seen[signature] = file;
    routes.push({ file, path });
  }

  return routes.sort((a, b) => {
    if (a.default || b.default)
      return Number(!!a.default) - Number(!!b.default);
    const left = a.path!.split('/');
    const right = b.path!.split('/');
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      const difference = rank(right[i]) - rank(left[i]);
      if (difference) return difference;
    }
    return a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
  });
}

function rank(segment: string | undefined): number {
  if (segment === undefined) return 4;
  return segment.startsWith(':') ? (segment.endsWith('+') ? 1 : 2) : 3;
}
