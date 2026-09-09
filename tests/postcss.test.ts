import postcss from 'postcss';
import { expect, it } from 'vitest';
import { createPostcssPlugins } from '../tooling/postcss';

it('converts landing px while preserving root size, hairlines and breakpoint conditions', async () => {
  const { css } = await postcss(createPostcssPlugins(true)).process(
    'html{font-size:37.5px}.box{width:150px;border:1px solid;padding:15px}@media(min-width:540px){.box{width:300px}}',
    { from: undefined },
  );
  expect(css).toContain('font-size:37.5px');
  expect(css).toContain('width:4rem');
  expect(css).toContain('border:1px solid');
  expect(css).toContain('min-width:540px');
  expect(css).toContain('width:8rem');
});

it('preserves agreement pixel sizes', async () => {
  const { css } = await postcss(createPostcssPlugins()).process(
    'p{font-size:16px}',
    { from: undefined },
  );
  expect(css).toContain('font-size:16px');
});
