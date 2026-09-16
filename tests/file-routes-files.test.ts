import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { createPageFiles } from '../tooling/file-routes/files';
import { resolveRoutes } from '../tooling/file-routes/resolve';

it('discovery and watcher matching agree, ignoring directories that look like pages', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'route-files-'));
  try {
    await mkdir(path.join(directory, 'fake.page.tsx'));
    await mkdir(path.join(directory, 'draft'));
    await writeFile(path.join(directory, 'home.page.tsx'), '');
    await writeFile(path.join(directory, 'draft/hidden.page.tsx'), '');
    await writeFile(path.join(directory, 'helper.ts'), '');
    const files = createPageFiles({
      extensions: ['tsx', 'page.tsx'],
      exclude: 'draft/**',
    });
    expect(await files.scan(directory)).toEqual([files.match('home.page.tsx')]);
    expect(files.match('home.page.tsx')?.stem).toBe('home');
    expect(files.match('draft\\hidden.page.tsx')).toBeUndefined();
    expect(files.match('helper.ts')).toBeUndefined();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('parses selected stems without knowing source extensions or scanning rules', () => {
  expect(
    resolveRoutes([
      { file: 'screen.custom', stem: 'users/[id]', default: false },
      { file: 'fallback.custom', stem: 'ignored', default: true },
    ]),
  ).toEqual([
    { file: 'screen.custom', path: '/users/:id' },
    { file: 'fallback.custom', default: true },
  ]);
  expect(resolveRoutes([])).toEqual([]);
});
