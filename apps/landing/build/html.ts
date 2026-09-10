import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import type { Plugin } from 'vite';
import { loadingHtml } from '../../../packages/feedback/src/notice/markup.ts';
import { createPostcssPlugins } from '../../../tooling/postcss.ts';

/** Keep startup visible before JS loads, then let loading() adopt the same nodes. */
export function landingHtml(theme: string): Plugin {
  return {
    name: 'landing-html',
    transformIndexHtml: {
      order: 'post',
      async handler(html, { bundle }) {
        let css: string;
        if (bundle) {
          const styles: string[] = [];
          const assets = Object.values(bundle);
          // Reuse Vite's compiled entry CSS; lazy route CSS stays in its chunks.
          html = html.replace(
            /<link\b[^>]*\brel="stylesheet"[^>]*>/g,
            (tag) => {
              const href = /\bhref="([^"]+)"/.exec(tag)?.[1];
              if (!href || /^(https?:)?\/\//.test(href)) return tag;
              const asset = assets.find((item) =>
                href.endsWith('/' + item.fileName),
              );
              if (asset?.type !== 'asset') return tag;
              styles.push(
                typeof asset.source === 'string'
                  ? asset.source
                  : new TextDecoder().decode(asset.source),
              );
              return '';
            },
          );
          // The legacy pass has no CSS and discards its intermediate HTML.
          if (!styles.length) return html;
          css = styles.join('\n');
        } else {
          // Dev injects CSS through JS, so startup needs its own compiled styles.
          const source = [
            new URL('../src/style.css', import.meta.url),
            new URL(
              '../../../packages/feedback/src/notice/style.css',
              import.meta.url,
            ),
          ]
            .map((file) => readFileSync(file, 'utf8'))
            .join('\n');
          css = (
            await postcss(createPostcssPlugins(true, theme)).process(source, {
              from: undefined,
            })
          ).css;
        }
        return {
          html: html.replace('<!-- page-loading -->', loadingHtml),
          tags: [
            {
              tag: 'style',
              attrs: {
                id: 'page-loading-style',
                ...(bundle ? { 'data-entry-css': true } : {}),
              },
              children: css.replace(/<\/style/gi, '<\\/style'),
              injectTo: 'head',
            },
          ],
        };
      },
    },
  };
}
