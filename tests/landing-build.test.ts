import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, it } from 'vitest';
import { createLandingFixture } from './helpers/landing';

it('inlines matching prerendered styles and preserves split CSS for SPA navigation', async () => {
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
    for (const [file, text, route, own, other] of [
      ['index.html', '静态首屏', '/campaign', '.home', '.offer'],
      ['offer/index.html', '预渲染活动', '/campaign/offer', '.offer', '.home'],
    ]) {
      const html = await readFile(path.join(output, file!), 'utf8');
      expect(html).toContain(text);
      expect(html).toContain(`data-page="${route}"`);
      expect(html).toContain('type="isodata"');
      const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
        .map((match) => match[1])
        .join('');
      expect(styles).toContain('box-sizing:border-box');
      expect(styles).toContain('.fixture');
      expect(styles).toContain(own);
      expect(styles).not.toContain(other);
      expect(styles).not.toContain('.client-only');
      expect(html).toMatch(/rel="preload"[^>]*href="\/campaign\/assets\//);
      expect(html).not.toContain('data-initial-loading');
    }
    const cssFiles = files.filter((file) => file.endsWith('.css'));
    expect(cssFiles.length).toBeGreaterThan(1);
    const externalCss = (
      await Promise.all(
        cssFiles.map((file) => readFile(path.join(output, file), 'utf8')),
      )
    ).join('');
    for (const selector of ['.fixture', '.home', '.offer', '.client-only']) {
      expect(externalCss).toContain(selector);
    }
    const fallback = await readFile(path.join(output, '200.html'), 'utf8');
    expect(fallback).toContain('<div id="app"></div>');
    expect(fallback).not.toContain('type="isodata"');
  } finally {
    await cleanup();
  }
}, 20000);
