import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, it } from 'vitest';
import { createLandingFixture } from './helpers/landing';

it('prerenders only explicit pages and emits an empty SPA fallback with shared CSS', async () => {
  const { directory, cleanup } = await createLandingFixture();
  try {
    const output = path.join(directory, 'dist');
    const files = (await readdir(output, { recursive: true })).map((file) =>
      file.replace(/\\/g, '/'),
    );
    expect(files.filter((file) => file.endsWith('.html')).sort()).toEqual([
      '200.html',
      'index.html',
      'offer/index.html',
    ]);
    for (const [file, text, route] of [
      ['index.html', '静态首屏', '/campaign'],
      ['offer/index.html', '预渲染活动', '/campaign/offer'],
    ]) {
      const html = await readFile(path.join(output, file!), 'utf8');
      expect(html).toContain(text);
      expect(html).toContain(`data-page="${route}"`);
      expect(html).toContain('type="isodata"');
      expect(html).toMatch(/rel="stylesheet"[^>]*href="\/campaign\/assets\//);
      expect(html).not.toContain('data-initial-loading');
    }
    const fallback = await readFile(path.join(output, '200.html'), 'utf8');
    expect(fallback).toContain('<div id="app"></div>');
    expect(fallback).not.toContain('type="isodata"');
  } finally {
    await cleanup();
  }
}, 20000);
