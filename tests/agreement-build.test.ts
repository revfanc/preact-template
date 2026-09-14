import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build, createServer, preview } from 'vite';
import { expect, it } from 'vitest';

it('generates all TSX documents with custom base, static CSS and only a classic runtime', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const source = path.join(root, 'apps/agreement');
  const fixture = await mkdtemp(path.join(root, 'apps/.agreement-ssg-'));
  try {
    for (const file of [
      'src',
      'index.html',
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'vite.runtime.config.ts',
    ]) {
      await cp(path.join(source, file), path.join(fixture, file), {
        recursive: true,
      });
    }
    await symlink(
      path.join(source, 'node_modules'),
      path.join(fixture, 'node_modules'),
      'junction',
    );
    await writeFile(
      path.join(fixture, '.env.prod'),
      'VITE_APP_ENV=prod\nVITE_BASE_PATH=/legal/\n',
    );
    await mkdir(path.join(fixture, 'src/pages/terms'), { recursive: true });
    await writeFile(
      path.join(fixture, 'src/pages/terms/index.tsx'),
      `
      import './style.css';
      export const title = '条款 & <说明>';
      export default function Terms() { return <h1 class="terms">静态正文</h1>; }
    `,
    );
    await writeFile(
      path.join(fixture, 'src/pages/terms/style.css'),
      '.terms { padding: 17px; }',
    );
    await build({
      configFile: path.join(fixture, 'vite.config.ts'),
      mode: 'prod',
      logLevel: 'silent',
    });
    const output = path.join(fixture, 'dist');
    const files = await readdir(output, { recursive: true });
    expect(
      files
        .filter((file) => file.endsWith('.html'))
        .map((file) => file.replace(/\\/g, '/'))
        .sort(),
    ).toEqual(['index.html', 'terms/index.html']);
    expect(
      files
        .filter((file) => /\.(js|mjs|map)$/.test(file))
        .map((file) => file.replace(/\\/g, '/')),
    ).toEqual(['runtime/agreement.js']);
    const html = await readFile(path.join(output, 'terms/index.html'), 'utf8');
    expect(html).toContain('<main><h1 class="terms">静态正文</h1></main>');
    expect(html).toContain('<title>条款 &amp; &lt;说明&gt;</title>');
    expect(html).toContain('name="app-env" content="prod"');
    expect(html).toContain('src="/legal/runtime/agreement.js"');
    expect(html).not.toMatch(/type="module"|modulepreload/);
    const cssPath = /href="\/legal\/([^"]+\.css)"/.exec(html)?.[1];
    expect(cssPath).toBeDefined();
    expect(await readFile(path.join(output, cssPath!), 'utf8')).toContain(
      '17px',
    );
    const server = await preview({
      configFile: path.join(fixture, 'vite.config.ts'),
      mode: 'prod',
      preview: { port: 0, strictPort: false },
    });
    try {
      const address = server.httpServer.address();
      if (!address || typeof address === 'string')
        throw new Error('Missing preview port');
      const origin = `http://127.0.0.1:${address.port}`;
      expect(await (await fetch(`${origin}/legal/terms/`)).text()).toContain(
        '静态正文',
      );
      expect((await fetch(`${origin}/legal/missing/`)).status).toBe(404);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.httpServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
    const dev = await createServer({
      configFile: path.join(fixture, 'vite.config.ts'),
      mode: 'prod',
      server: { port: 0, strictPort: false },
    });
    try {
      await dev.listen();
      const address = dev.httpServer?.address();
      if (!address || typeof address === 'string')
        throw new Error('Missing dev port');
      const origin = `http://127.0.0.1:${address.port}`;
      const document = await (await fetch(`${origin}/legal/terms/`)).text();
      expect(document).toContain(
        '<main><h1 class="terms">静态正文</h1></main>',
      );
      expect(document).toContain('href="/legal/src/pages/terms/style.css"');
      expect(
        await (await fetch(`${origin}/legal/src/pages/terms/style.css`)).text(),
      ).toContain('17px');
      expect((await fetch(`${origin}/legal/missing/`)).status).toBe(404);
    } finally {
      await dev.close();
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}, 30000);
