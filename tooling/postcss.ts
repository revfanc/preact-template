import globalData from '@csstools/postcss-global-data';
import customProperties from 'postcss-custom-properties';
import autoprefixer from 'autoprefixer';
import pxtorem from 'postcss-pxtorem';
import { fileURLToPath } from 'node:url';
import { legacyTargets } from './compatibility.ts';
import type { Plugin } from 'postcss';

const defaults = fileURLToPath(
  new URL('../packages/theme/src/index.css', import.meta.url),
);

export function createPostcssPlugins(rem = false, theme?: string) {
  return [
    globalData({ files: [defaults, ...(theme ? [theme] : [])] }),
    customProperties({ preserve: false }),
    {
      postcssPlugin: 'validate-theme',
      OnceExit(root) {
        root.walkDecls((declaration) => {
          if (/\bvar\(/i.test(declaration.value)) {
            throw declaration.error(
              `Unresolved theme variable: ${declaration.value}`,
            );
          }
        });
      },
    } satisfies Plugin,
    ...(rem
      ? [
          pxtorem({
            rootValue: 37.5,
            propList: ['*'],
            minPixelValue: 2,
            mediaQuery: false,
            selectorBlackList: ['html', '.no-rem'],
          }),
        ]
      : []),
    autoprefixer({ overrideBrowserslist: legacyTargets }),
  ];
}
