import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, it } from 'vitest';
import { createLandingFixture } from './helpers/landing';

it('inlines matching prerendered styles and preserves split CSS for SPA navigation', async () => {
  const { directory, cleanup } = await createLandingFixture({ rum: true });
  try {
    const output = path.join(directory, 'dist');
    const files = (await readdir(output, { recursive: true })).map((file) =>
      file.replace(/\\/g, '/'),
    );
    expect(files.filter((file) => file.endsWith('.html')).sort()).toEqual([
      'index.html',
      'offer/index.html',
      'start/index.html',
    ]);
    const fallback = await readFile(path.join(output, 'index.html'), 'utf8');
    expect(
      await readFile(path.join(output, 'start/index.html'), 'utf8'),
    ).toContain('data-request="true"');
    expect(fallback).toMatch(/<div id="app">\s*<\/div>/);
    expect(fallback).not.toContain('type="isodata"');
    expect(fallback).not.toContain('rel="modulepreload"');
    for (const [file, text, route, own, other] of [
      ['start/index.html', '静态首屏', '/campaign/start', '.start', '.offer'],
      ['offer/index.html', '预渲染活动', '/campaign/offer', '.offer', '.start'],
    ]) {
      const html = await readFile(path.join(output, file!), 'utf8');
      expect(html).toContain('window.__rum=');
      expect(html).toContain('"version":"fixture"');
      expect(html).toMatch(
        /<script[^>]+src="https:\/\/sdk\.rum\.aliyuncs\.com\/v2\/browser-sdk\.js"[^>]*async/,
      );
      expect(html).toContain(text);
      expect(html).toContain(`data-page="${route}"`);
      expect(html).toContain('type="isodata"');
      const page = path.posix.dirname(file!);
      const script = files.find((name) =>
        new RegExp(`^assets/${page}-[^/]+\\.js$`).test(name),
      );
      expect(script).toBeDefined();
      expect(html).toContain(
        `rel="modulepreload" crossorigin href="/campaign/${script}"`,
      );
      const links = [...html.matchAll(/<link\b[^>]*href="([^"]+)"[^>]*>/g)].map(
        (match) => match[1],
      );
      expect(
        links.some((href) => href?.match(/\/(?:client|detail|disabled)-/)),
      ).toBe(false);
      expect(
        links.some((href) =>
          href?.includes(`/${page === 'start' ? 'offer' : 'start'}-`),
        ),
      ).toBe(false);
      expect(
        links.some((href) => href?.match(new RegExp(`/${page}-[^/]+\\.css$`))),
      ).toBe(true);
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
    for (const selector of ['.fixture', '.start', '.offer', '.client-only']) {
      expect(externalCss).toContain(selector);
    }
  } finally {
    await cleanup();
  }
}, 20000);
