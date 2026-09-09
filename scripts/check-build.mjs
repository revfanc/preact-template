import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'acorn';

const mode = process.argv[2] ?? 'test';
assert(['test', 'prod'].includes(mode), 'mode must be test or prod');
const root = fileURLToPath(new URL('..', import.meta.url));

for (const app of ['landing', 'agreement']) {
  const directory = path.join(root, 'apps', app, 'dist', mode);
  const html = await readFile(path.join(directory, 'index.html'), 'utf8');
  assert(
    html.includes(`name="app-env" content="${mode}"`),
    `${app}: wrong environment`,
  );
  assert(
    html.includes('vite-legacy-entry') && html.includes('type="module"'),
    `${app}: missing dual entries`,
  );
  const assets = await readdir(path.join(directory, 'assets'));
  const legacy = assets.filter(
    (name) => name.includes('-legacy-') && name.endsWith('.js'),
  );
  assert(legacy.length >= 2, `${app}: missing legacy runtime or polyfills`);
  for (const file of legacy) {
    const source = await readFile(path.join(directory, 'assets', file), 'utf8');
    parse(source, { ecmaVersion: 2015, sourceType: 'script' });
  }
  const css = (
    await Promise.all(
      assets
        .filter((file) => file.endsWith('.css'))
        .map((file) => readFile(path.join(directory, 'assets', file), 'utf8')),
    )
  ).join('\n');
  assert(
    !/:where\(|:is\(|@layer\b|oklch\(|color-mix\(/.test(css),
    `${app}: CSS exceeds the template compatibility rules`,
  );
  if (app === 'landing')
    assert(css.includes('rem'), 'landing: px-to-rem missing');
  else
    assert(
      html.includes('一、文档用途') && css.includes('16px'),
      'agreement: static body or normal text sizing missing',
    );
  console.log(
    `${app}/${mode}: environment, static HTML, CSS and ${legacy.length} legacy scripts checked`,
  );
}
