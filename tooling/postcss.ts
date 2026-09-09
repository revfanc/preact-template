import autoprefixer from 'autoprefixer';
import pxtorem from 'postcss-pxtorem';
import { legacyTargets } from './compatibility.ts';

export function createPostcssPlugins(rem = false) {
  return [
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
