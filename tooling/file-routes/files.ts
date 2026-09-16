import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { createFilter, normalizePath } from 'vite';
import type { PageFile, RouteOptions } from './types.ts';

/** Selection is identical for initial discovery and watcher events. */
export function createPageFiles(options: RouteOptions = {}) {
  const extensions = (options.extensions ?? ['tsx', 'jsx'])
    .map((extension) => '.' + extension)
    .sort((a, b) => b.length - a.length);
  const filter = createFilter(options.include ?? '**/*', options.exclude, {
    resolve: false,
  });
  const fallback = options.notFound && normalizePath(options.notFound);

  function match(source: string): PageFile | undefined {
    const file = normalizePath(source);
    const extension = extensions.find((suffix) => file.endsWith(suffix));
    if (!extension || (file !== fallback && !filter(file))) return;
    return {
      file,
      stem: file.slice(0, -extension.length),
      default: file === fallback,
    };
  }

  async function scan(directory: string): Promise<PageFile[]> {
    const entries = await readdir(directory, {
      recursive: true,
      withFileTypes: true,
    });
    const pages: PageFile[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const page = match(
        path.relative(directory, path.join(entry.parentPath, entry.name)),
      );
      if (page) pages.push(page);
    }
    return pages;
  }

  return { match, scan };
}
