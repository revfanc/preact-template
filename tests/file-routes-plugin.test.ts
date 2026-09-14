import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import { expect, it, vi } from 'vitest';
import { fileRoutes } from '../apps/landing/build/routes';

it('generates lazy routes and invalidates the virtual module when pages are added or removed', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'landing-routes-'));
  const directory = path.join(root, 'src/pages');
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'index.tsx'),
    'export default function Home() { return null; }',
  );
  const server = await createServer({
    configFile: false,
    root,
    plugins: [fileRoutes()],
    server: { port: 0 },
  });
  try {
    await server.listen();
    const send = vi.spyOn(server.ws, 'send');
    const read = async () =>
      (await server.transformRequest('virtual:file-routes'))!.code;
    expect(await read()).toContain('load: () => import(');
    const file = path.join(directory, 'result/index.tsx');
    await mkdir(path.dirname(file));
    await writeFile(file, 'export default function Result() { return null; }');
    await expect.poll(() => send.mock.calls.length).toBeGreaterThan(0);
    expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
    await expect.poll(read).toContain('result/index.tsx');
    send.mockClear();
    await rm(file);
    await expect.poll(() => send.mock.calls.length).toBeGreaterThan(0);
    await expect.poll(read).not.toContain('result/index.tsx');
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
}, 15000);
