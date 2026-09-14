import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { preview } from 'vite';
import { expect, it } from 'vitest';
import { createAgreementFixture } from './helpers/agreement';

it('generates every document with inline CSS, custom base and hydration entries', async () => {
  const { directory, cleanup } = await createAgreementFixture();
  const config = {
    configFile: path.join(directory, 'vite.config.ts'),
    mode: 'prod',
  };
  try {
    const output = path.join(directory, 'dist');
    const files = (await readdir(output, { recursive: true })).map((file) =>
      file.replace(/\\/g, '/'),
    );
    expect(files.filter((file) => file.endsWith('.html')).sort()).toEqual([
      'index.html',
      'terms/index.html',
    ]);
    expect(
      files.filter(
        (file) => file.endsWith('.css') || /runtime|\.map$|-legacy-/.test(file),
      ),
    ).toEqual([]);
    const html = await readFile(path.join(output, 'terms/index.html'), 'utf8');
    expect(html).toContain('<h1 class="terms">静态正文</h1>');
    expect(html).toContain('计数 0');
    expect(html).toContain('<title>条款 &amp; &lt;说明&gt;</title>');
    expect(html).toContain('name="app-env" content="prod"');
    expect(html).toContain('type="isodata"');
    expect(html).toContain('type="module"');
    expect(html).not.toContain('id="vite-legacy-entry"');
    for (const [, source] of html.matchAll(
      /<script\b[^>]*\b(?:src|data-src)="([^"]+)"/g,
    )) {
      expect(source).toMatch(/^\/legal\/assets\//);
      expect(files).toContain(source!.slice('/legal/'.length));
    }
    expect(html).toContain('<style id="agreement-style">');
    expect(html).toContain('17px');
    expect(html).not.toMatch(/rel="stylesheet"|var\(--|ssr-outlet/);
    const server = await preview({
      ...config,
      preview: { port: 0, strictPort: false },
    });
    try {
      const address = server.httpServer.address();
      if (!address || typeof address === 'string')
        throw new Error('Missing preview port');
      const origin = `http://127.0.0.1:${address.port}`;
      for (const route of ['/legal/terms/', '/legal/terms/index.html']) {
        expect(await (await fetch(origin + route)).text()).toContain(
          '静态正文',
        );
      }
      expect((await fetch(`${origin}/legal/missing/`)).status).toBe(404);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.httpServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  } finally {
    await cleanup();
  }
}, 60000);
