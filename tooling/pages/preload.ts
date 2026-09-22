import path from 'node:path';
import { normalizePath, type Rolldown } from 'vite';
import type { PageEntry } from './index.ts';

/** Runs after prerendering, before critical CSS processing. Never follows dynamic imports. */
export function preloadPages(
  bundle: Rolldown.OutputBundle,
  pages: PageEntry[],
  base: string,
) {
  const chunks = Object.values(bundle).filter((item) => item.type === 'chunk');
  for (const page of pages) {
    const filename = path.posix.join(page.path.slice(1), 'index.html');
    const asset = Object.values(bundle).find(
      (item) => normalizePath(item.fileName) === filename,
    );
    if (asset?.type !== 'asset') continue;
    const entry = chunks.find((chunk) =>
      Object.keys(chunk.modules).some((id) => normalizePath(id) === page.file),
    );
    if (!entry) throw new Error(`Missing page chunk: ${page.file}`);

    const html =
      typeof asset.source === 'string'
        ? asset.source
        : new TextDecoder().decode(asset.source);
    const visited = new Set<string>();
    const styles = new Set<string>();
    const links: string[] = [];
    const addLink = (file: string, rel: string) => {
      const url =
        base === './' || base === ''
          ? './' + path.posix.relative(path.posix.dirname(filename), file)
          : base + file;
      const href = url
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
      // Existing entry scripts and shared styles already start loading from HTML.
      if (html.includes(`src="${href}"`) || html.includes(`href="${href}"`))
        return;
      links.push(`<link rel="${rel}" crossorigin href="${href}">`);
    };
    const visit = (file: string) => {
      if (visited.has(file)) return;
      visited.add(file);
      const chunk = bundle[file];
      if (chunk?.type !== 'chunk') return;
      addLink(file, 'modulepreload');
      for (const dependency of chunk.imports) visit(dependency);
      for (const css of chunk.viteMetadata?.importedCss ?? []) styles.add(css);
    };
    visit(entry.fileName);
    for (const css of styles) addLink(css, 'stylesheet');
    asset.source = html.replace('</head>', links.join('\n') + '\n</head>');
  }
}
