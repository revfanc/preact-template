import postcss from 'postcss';
import { expect, it } from 'vitest';
import { createPostcssPlugins } from '../tooling/postcss';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

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

it('applies an application theme to feedback and shared components without runtime variables', async () => {
  const override = fileURLToPath(
    new URL('./fixtures/theme.css', import.meta.url),
  );
  for (const file of [
    '../packages/feedback/src/style.css',
    '../packages/components/src/page-state/index.module.css',
  ]) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    const { css } = await postcss(createPostcssPlugins(true, override)).process(
      source,
      { from: undefined },
    );
    expect(css).toContain('#123abc');
    expect(css).toContain('#fefefe');
    expect(css).not.toContain('#166348');
    expect(css).not.toContain('--primary:');
    expect(css).not.toMatch(/\$[a-z]+|var\(/);
  }
  const { css } = await postcss(createPostcssPlugins()).process(
    '.button{color:var(--primary)}',
    { from: undefined },
  );
  expect(css).toContain('#166348');
});

it('rejects unknown theme variables instead of shipping invalid CSS', async () => {
  await expect(
    postcss(createPostcssPlugins())
      .process('.button{color:var(--unknown)}', { from: undefined })
      .async(),
  ).rejects.toThrow('Unresolved theme variable');
});

it('resolves nested CSS fallbacks before checking for unsupported runtime variables', async () => {
  const { css } = await postcss(createPostcssPlugins()).process(
    '.button{color:var(--missing,var(--primary));border:1px solid var(--other,#fff)}',
    { from: undefined },
  );
  expect(css).toContain('color:#166348');
  expect(css).toContain('border:1px solid #fff');
  expect(css).not.toContain('var(');
});
