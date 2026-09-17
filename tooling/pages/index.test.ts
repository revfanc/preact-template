import { mkdtemp, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import { afterEach, expect, it, vi } from 'vitest';
import { pages } from './index';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function workspace(
  files: string[] | Record<string, string>,
  options: Parameters<typeof pages>[0] = {},
) {
  const root = await mkdtemp(path.join(tmpdir(), 'vite-pages-'));
  cleanups.push(() =>
    rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }),
  );
  const folder = path.resolve(root, options.directory ?? 'src/pages');
  await mkdir(folder, { recursive: true });
  const entries = Array.isArray(files)
    ? files.map(
        (file) =>
          [
            file,
            'export const title = "Test"; export default function Page() { return null; }',
          ] as const,
      )
    : Object.entries(files);
  for (const [file, source] of entries) {
    await mkdir(path.dirname(path.join(folder, file)), { recursive: true });
    await writeFile(path.join(folder, file), source);
  }
  let ready!: Promise<void>;
  const server = await createServer({
    root,
    configFile: false,
    plugins: [
      pages(options),
      {
        name: 'watch-ready',
        configureServer(server) {
          ready = new Promise((resolve) =>
            server.watcher.once('ready', resolve),
          );
        },
      },
    ],
    server: { port: 0 },
  });
  cleanups.push(() => server.close());
  await server.listen();
  await ready;
  const id = options.eager ? 'virtual:pages/eager' : 'virtual:pages';
  return {
    root,
    folder,
    server,
    id,
    read: async () => (await server.ssrLoadModule(id)).pages,
    readPrerenderPaths: async () =>
      (await server.ssrLoadModule(id)).prerenderPaths,
  };
}

// File conventions: https://uvr.esm.is/guide/file-based-routing
it('generates flat and directory routes with required, optional and catch-all parameters', async () => {
  const app = await workspace([
    'index.tsx',
    'about.jsx',
    'p1/p2026090901/index.tsx',
    'detail/[...path].tsx',
    'detail/[[id]].tsx',
    'detail/[id]/index.tsx',
    'detail/new.tsx',
    '[...path]/index.tsx',
  ]);
  const entries = await app.read();
  expect(
    entries.map(({ file, path }: { file: string; path: string }) => [
      file,
      path,
    ]),
  ).toEqual([
    ['index.tsx', '/'],
    ['about.jsx', '/about'],
    ['detail/new.tsx', '/detail/new'],
    ['p1/p2026090901/index.tsx', '/p1/p2026090901'],
    ['detail/[id]/index.tsx', '/detail/:id'],
    ['detail/[[id]].tsx', '/detail/:id?'],
    ['detail/[...path].tsx', '/detail/:path*'],
    ['[...path]/index.tsx', '/:path*'],
  ]);
  expect((await entries[1].load()).title).toBe('Test');
});

it('uses explicit glob exclusions instead of special underscore names', async () => {
  const app = await workspace(
    {
      'index.tsx': 'export default () => null;',
      '_private/index.tsx': 'export default () => null;',
      'components/card.tsx': 'export const prerender = "not metadata";',
      'about.test.tsx': 'export const prerender = "not metadata";',
    },
    { exclude: ['src/pages/components/**', '**/*.test.*'] },
  );
  expect(
    (await app.read()).map((entry: { path: string }) => entry.path),
  ).toEqual(['/', '/_private']);
  expect(await app.readPrerenderPaths()).toEqual([]);
  const module = await app.server.ssrLoadModule(
    path.join(app.folder, 'components/card.tsx'),
  );
  expect(module.prerender).toBe('not metadata');
});

it('collects literal prerender opt-ins without executing page modules', async () => {
  const app = await workspace({
    'p1/p2026091101/index.tsx':
      'export const prerender: boolean = true; throw new Error("Page must stay lazy"); export default () => null;',
    'disabled.tsx':
      'export const prerender = false; export default () => null;',
    'unmarked.tsx': 'export default () => null;',
    'comment.tsx':
      '// export const prerender = true;\nexport default () => null;',
    'string.tsx':
      'const text = "export const prerender = true"; export default () => <p>{text}</p>;',
    'local.tsx':
      'const prerender = true; export default () => <p>{String(prerender)}</p>;',
  });
  expect(await app.readPrerenderPaths()).toEqual(['/p1/p2026091101']);
  expect(await app.read()).toHaveLength(6);
});

it.each([false, true])(
  'consumes build metadata and preserves other exports; eager=%s',
  async (eager) => {
    const app = await workspace(
      {
        'about.tsx':
          'export const prerender = true; export const title = "About"; export default function Page() { return prerender; }',
      },
      { eager },
    );
    expect(await app.readPrerenderPaths()).toEqual(['/about']);
    const [entry] = await app.read();
    const module = eager ? entry.page : await entry.load();
    expect(module.prerender).toBeUndefined();
    expect(module.title).toBe('About');
    expect(module.default()).toBe(true);
  },
);

it.each([
  'export let prerender = true;',
  'export const prerender = "true";',
  'export const prerender = Boolean(1);',
  'export const prerender = true, title = "Test";',
])(
  'rejects nonliteral or mutable prerender declarations: %s',
  async (source) => {
    const app = await workspace({ 'index.tsx': source });
    await expect(app.readPrerenderPaths()).rejects.toThrow(
      'Use a standalone export const prerender = true or false: index.tsx',
    );
  },
);

it.each(['[id].tsx', '[[id]].tsx', '[...path]/index.tsx'])(
  'rejects prerendering a route without a concrete path: %s',
  async (file) => {
    const app = await workspace({ [file]: 'export const prerender = true;' });
    await expect(app.readPrerenderPaths()).rejects.toThrow(
      `Prerender requires a concrete page path: ${file}`,
    );
  },
);

it('refreshes prerender metadata when a page changes', async () => {
  const app = await workspace({
    'about.tsx': 'export const prerender = false;',
  });
  expect(await app.readPrerenderPaths()).toEqual([]);
  await writeFile(
    path.join(app.folder, 'about.tsx'),
    'export const prerender = true;',
  );
  await expect.poll(app.readPrerenderPaths).toEqual(['/about']);
});

it('preserves module exports in eager mode with a custom folder and glob', async () => {
  const app = await workspace(
    ['index.ts', 'terms/index.ts', 'helper.ts', '_private/index.ts'],
    {
      directory: 'documents',
      pattern: '**/index.ts',
      exclude: '**/_private/**',
      eager: true,
      staticOnly: true,
    },
  );
  const entries = await app.read();
  expect(entries.map((entry: { path: string }) => entry.path)).toEqual([
    '/',
    '/terms',
  ]);
  expect(entries[1].page.title).toBe('Test');
  expect(typeof entries[1].page.default).toBe('function');
  expect(entries[1].load).toBeUndefined();
});

it.each([
  ['about/index.tsx', 'about/index.jsx'],
  ['[id].tsx', '[name]/index.tsx'],
  ['[...path].tsx', '[...rest].jsx'],
  ['[[id]].tsx', '[[name]].tsx'],
])('rejects conflicting records: %s, %s', async (a, b) => {
  const app = await workspace([a, b]);
  await expect(app.read()).rejects.toThrow('Conflicting pages:');
});

it.each([
  '[id]/[id].tsx',
  '[...path]/edit.tsx',
  '[[id]]/edit.tsx',
  'bad name.tsx',
  'users.[id].tsx',
  'user-[id].tsx',
  '(group)/index.tsx',
  'index@aside.tsx',
  '[ids]+.tsx',
  '[[ids]]+.tsx',
])('rejects invalid page %s', async (file) => {
  const app = await workspace([file]);
  await expect(app.read()).rejects.toThrow();
});

it.each(['[id].tsx', '[[id]].tsx', '[...path].tsx'])(
  'rejects unexpanded static routes: %s',
  async (file) => {
    const app = await workspace([file], { eager: true, staticOnly: true });
    await expect(app.read()).rejects.toThrow(
      'Static pages cannot contain parameters:',
    );
  },
);

it('allows an empty directory and skips directories resembling page files', async () => {
  const app = await workspace([]);
  await mkdir(path.join(app.folder, 'fake.tsx'));
  expect(await app.read()).toEqual([]);
});

it.each([false, true])(
  'refreshes additions, renames and deletions; eager=%s',
  async (eager) => {
    const app = await workspace(['index.tsx'], { eager });
    await app.read();
    const send = vi.spyOn(app.server.ws, 'send');
    const readCode = async () =>
      (await app.server.transformRequest(app.id))!.code;
    await readCode();
    await writeFile(
      path.join(app.folder, 'about.tsx'),
      'export default function About() { return null; }',
    );
    await expect.poll(readCode, { timeout: 5000 }).toContain('about.tsx');
    expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
    await rename(
      path.join(app.folder, 'about.tsx'),
      path.join(app.folder, 'contact.tsx'),
    );
    await expect.poll(readCode, { timeout: 5000 }).toContain('contact.tsx');
    await expect.poll(readCode, { timeout: 5000 }).not.toContain('about.tsx');
    await rm(path.join(app.folder, 'contact.tsx'));
    await expect.poll(readCode, { timeout: 5000 }).not.toContain('contact.tsx');
  },
);

it.each(['users/index.tsx', 'users/[id].tsx'])(
  'rejects implicit nested layouts rather than flattening them: %s',
  async (child) => {
    const app = await workspace(['users.tsx', child]);
    await expect(app.read()).rejects.toThrow(
      'Nested layouts are not supported',
    );
  },
);

it('ignores excluded additions, changes and deletions in development', async () => {
  const app = await workspace(['index.tsx'], { exclude: '**/*.test.*' });
  await app.read();
  const send = vi.spyOn(app.server.ws, 'send');
  const file = path.join(app.folder, 'about.test.tsx');
  for (const event of ['add', 'change', 'unlink']) {
    const watched = new Promise<void>((resolve) => {
      const listener = (name: string, filename: string) => {
        if (name !== event || filename !== file) return;
        app.server.watcher.off('all', listener);
        resolve();
      };
      app.server.watcher.on('all', listener);
    });
    if (event === 'unlink') await rm(file);
    else await writeFile(file, `export const value = '${event}';`);
    await watched;
    expect(
      (await app.read()).map((entry: { path: string }) => entry.path),
    ).toEqual(['/']);
  }
  expect(send).not.toHaveBeenCalledWith({ type: 'full-reload' });
});
