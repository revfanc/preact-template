import { mkdtemp, mkdir, writeFile, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import { expect, it, vi } from 'vitest';
import { fileRoutes } from '../tooling/file-routes';

it('generates lazy routes and invalidates the virtual module when pages are added or removed', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'landing-routes-'));
  const directory = path.join(root, 'src/pages');
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'index.tsx'),
    'export default function Home() { return null; }',
  );
  let watcherReady!: Promise<void>;
  const server = await createServer({
    configFile: false,
    root,
    plugins: [
      fileRoutes(),
      {
        name: 'test-watch-ready',
        configureServer(server) {
          watcherReady = new Promise((resolve) =>
            server.watcher.once('ready', resolve),
          );
        },
      },
    ],
    server: { port: 0 },
  });
  try {
    await server.listen();
    await watcherReady;
    const send = vi.spyOn(server.ws, 'send');
    const read = async () =>
      (await server.transformRequest('virtual:file-routes'))!.code;
    expect(await read()).toContain('load: () => import(');
    const file = path.join(directory, 'result/index.tsx');
    await mkdir(path.dirname(file));
    await writeFile(file, 'export default function Result() { return null; }');
    await expect
      .poll(() => send.mock.calls.length, { timeout: 5000 })
      .toBeGreaterThan(0);
    expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
    await expect.poll(read, { timeout: 5000 }).toContain('result/index.tsx');
    await rename(
      path.join(directory, 'result'),
      path.join(directory, 'renamed'),
    );
    await expect.poll(read, { timeout: 5000 }).toContain('renamed/index.tsx');
    await expect
      .poll(read, { timeout: 5000 })
      .not.toContain('result/index.tsx');
    send.mockClear();
    await rm(path.join(directory, 'renamed/index.tsx'));
    await expect
      .poll(() => send.mock.calls.length, { timeout: 5000 })
      .toBeGreaterThan(0);
    await expect
      .poll(read, { timeout: 5000 })
      .not.toContain('renamed/index.tsx');
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
}, 15000);

it('loads eager page exports from a custom directory and excludes private pages', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'static-routes-'));
  const directory = path.join(root, 'documents');
  await mkdir(path.join(directory, 'draft'), { recursive: true });
  await writeFile(
    path.join(directory, 'home.page.ts'),
    'export const title = "Home"; export default function Home() { return null; }',
  );
  await writeFile(
    path.join(directory, 'draft/internal.page.ts'),
    'throw new Error("Excluded page was imported")',
  );
  const server = await createServer({
    configFile: false,
    root,
    plugins: [
      fileRoutes({
        dir: 'documents',
        extensions: ['page.ts'],
        index: 'home',
        exclude: ['draft/**'],
        importMode: 'eager',
        dynamic: false,
      }),
    ],
    server: { middlewareMode: true },
  });
  try {
    const { routes } = await server.ssrLoadModule('virtual:file-routes/eager');
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      file: 'home.page.ts',
      path: '/',
      page: { title: 'Home' },
    });
    expect(typeof routes[0].page.default).toBe('function');
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
