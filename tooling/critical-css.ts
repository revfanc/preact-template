import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import Beasties from 'beasties';
import type { Plugin, ResolvedConfig } from 'vite';

export function criticalCss(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'critical-css',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    // Prerendered HTML and split CSS must both exist before Beasties reads them.
    writeBundle: {
      order: 'pre',
      sequential: true,
      async handler(_options, bundle) {
        const directory = path.resolve(config.root, config.build.outDir);
        const assets = Object.values(bundle).filter(
          (item) => item.type === 'asset',
        );
        const stylesheets = assets
          .filter((asset) => asset.fileName.endsWith('.css'))
          .map((asset) => config.base + asset.fileName);

        for (const asset of assets.filter((item) =>
          item.fileName.endsWith('.html'),
        )) {
          const html =
            typeof asset.source === 'string'
              ? asset.source
              : new TextDecoder().decode(asset.source);
          const beasties = new Beasties({
            path: directory,
            publicPath: config.base,
            // Lazy route CSS has no <link> in the prerendered document.
            additionalStylesheets: stylesheets.filter(
              (href) => !html.includes(href),
            ),
            preload: 'swap',
            pruneSource: false,
          });
          asset.source = await beasties.process(html);
          await writeFile(path.join(directory, asset.fileName), asset.source);
        }
      },
    },
  };
}
