import { createServer } from 'vite';
import { expect, it } from 'vitest';
import { rum } from './rum';

it('leaves HTML unchanged when monitoring is disabled and safely configures the official SDK when enabled', async () => {
  for (const endpoint of [
    undefined,
    'https://example.test/rum?value=</script>',
  ]) {
    const server = await createServer({
      configFile: false,
      server: { middlewareMode: true, watch: null },
      plugins: [
        rum({
          app: 'landing',
          env: 'daily',
          endpoint,
          version: 'test-build',
          spa: true,
        }),
      ],
    });
    try {
      const html = await server.transformIndexHtml(
        '/',
        '<html><head></head><body><div id="app"></div></body></html>',
      );
      if (!endpoint) {
        expect(html).not.toContain('__rum');
        expect(html).not.toContain('rum.aliyuncs.com');
      } else {
        expect(html).toContain('async');
        expect(html).toContain(
          'https://sdk.rum.aliyuncs.com/v2/browser-sdk.js',
        );
        expect(html).toContain('"spaMode":"history"');
        expect(html).toContain('"env":"daily"');
        expect(html).toContain('"version":"test-build"');
        expect(html).not.toContain('value=</script>');
        expect(html.indexOf('<body>')).toBeLessThan(
          html.indexOf('window.__rum'),
        );
        expect(html.indexOf('window.__rum')).toBeLessThan(
          html.indexOf('browser-sdk.js'),
        );
      }
    } finally {
      await server.close();
    }
  }
});
