import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'acorn';
import { loadEnv } from 'vite';

const mode = process.argv[2] ?? 'test';
assert(['test', 'prod'].includes(mode), 'mode must be test or prod');
const root = fileURLToPath(new URL('..', import.meta.url));

{
  const app = 'landing';
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
  assert(
    html.includes('id="page-loading-style"') &&
      html.includes('class="pkg-ui-page-loading"'),
    'landing: initial HTML loading indicator missing',
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
  const inlineCss = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
    .map((match) => match[1])
    .join('\n');
  const css =
    inlineCss +
    (
      await Promise.all(
        assets
          .filter((file) => file.endsWith('.css'))
          .map((file) =>
            readFile(path.join(directory, 'assets', file), 'utf8'),
          ),
      )
    ).join('\n');
  assert(
    !/:where\(|:is\(|@layer\b|oklch\(|color-mix\(/.test(css),
    `${app}: CSS exceeds the template compatibility rules`,
  );
  assert(css.includes('rem'), 'landing: px-to-rem missing');
  console.log(
    `${app}/${mode}: environment, static HTML, CSS and ${legacy.length} legacy scripts checked`,
  );
}

const appRoot = path.join(root, 'apps/agreement');
const directory = path.join(appRoot, 'dist', mode);
const files = await readdir(directory, { recursive: true });
const pages = files.filter((file) => file.endsWith('.html'));
assert(pages.includes('index.html'), 'agreement: missing index.html');
let inlineCss = '';
const scripts = new Set();
const base =
  `/${(loadEnv(mode, appRoot, 'VITE_').VITE_BASE_PATH || '/agreement/').replace(/^\/+|\/+$/g, '')}/`.replace(
    '//',
    '/',
  );
for (const page of pages) {
  const html = await readFile(path.join(directory, page), 'utf8');
  assert(
    html.includes(`name="app-env" content="${mode}"`),
    `${page}: wrong environment`,
  );
  assert(
    /<h1\b/.test(html) && /<main\b/.test(html),
    `${page}: missing static body`,
  );
  const tags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.equal(tags.length, 1, `${page}: expected only the classic runtime`);
  assert(
    !/type="module"|\bnomodule\b|astro-island|astro-slot/.test(html),
    `${page}: unexpected client framework/module entry`,
  );
  const attrs = tags[0][1];
  assert(
    /\bid="agreement-runtime"/.test(attrs) && /\bdefer\b/.test(attrs),
    `${page}: missing deferred runtime`,
  );
  const source = /\bsrc="([^"]+)"/.exec(attrs)?.[1];
  assert(
    source === `${base}runtime/agreement.js`,
    `${page}: runtime has wrong base`,
  );
  assert.equal(tags[0][2].trim(), '', `${page}: unexpected inline script`);
  const script = source.slice(base.length);
  assert(
    files.includes(path.normalize(script)),
    `${page}: runtime file missing`,
  );
  scripts.add(script);
  const head = /<head>([\s\S]*?)<\/head>/.exec(html)?.[1] ?? '';
  const styles = [...head.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(
    (match) => match[1],
  );
  inlineCss += styles.join('\n');
  const links = [
    ...head.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g),
  ];
  assert(styles.length + links.length > 0, `${page}: no initial stylesheet`);
  for (const [, href] of links) {
    assert(
      href.startsWith(base) &&
        files.includes(path.normalize(href.slice(base.length))),
      `${page}: stylesheet file missing or wrong base`,
    );
  }
}
assert.equal(scripts.size, 1, 'agreement: pages must share one runtime');
for (const file of scripts) {
  parse(await readFile(path.join(directory, file), 'utf8'), {
    ecmaVersion: 2015,
    sourceType: 'script',
  });
}
const css =
  inlineCss +
  (
    await Promise.all(
      files
        .filter((file) => file.endsWith('.css'))
        .map((file) => readFile(path.join(directory, file), 'utf8')),
    )
  ).join('\n');
assert(
  !/:where\(|:is\(|@layer\b|oklch\(|color-mix\(/.test(css),
  'agreement: CSS exceeds the template compatibility rules',
);
assert(css.includes('16px'), 'agreement: normal text sizing missing');
console.log(
  `agreement/${mode}: ${pages.length} HTML pages, environment, CSS and one classic script checked`,
);
