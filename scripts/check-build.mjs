import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'acorn';
import { loadEnv } from 'vite';
import postcss from 'postcss';

const mode = process.argv[2] ?? 'test';
assert(['test', 'prod'].includes(mode), 'mode must be test or prod');
const root = fileURLToPath(new URL('..', import.meta.url));

function checkTheme(css, app) {
  postcss.parse(css).walkDecls((declaration) => {
    assert(
      !/\$[a-z]+|var\(/i.test(declaration.value),
      `${app}: uncompiled theme value in ${declaration.prop}`,
    );
  });
}

{
  const app = 'landing';
  const directory = path.join(root, 'apps', app, 'dist');
  const html = await readFile(path.join(directory, 'index.html'), 'utf8');
  assert(
    html.includes(`name="app-env" content="${mode}"`),
    `${app}: wrong environment`,
  );
  assert(
    !html.includes('vite-legacy-entry') && html.includes('type="module"'),
    `${app}: missing module entry or unexpected legacy entry`,
  );
  const base =
    loadEnv(mode, path.join(root, 'apps', app), 'VITE_').VITE_BASE_PATH || '/';
  const resourceURLs = [...html.matchAll(/\b(?:src|href|data-src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((url) => url.includes('/assets/'));
  assert(
    resourceURLs.length > 0 &&
      resourceURLs.every((url) => url.startsWith(base)),
    `${app}: asset URLs must use ${base}`,
  );
  assert(
    /<div id="app">\s*<\/div>/.test(html) && !html.includes('type="isodata"'),
    'landing: index.html must be an empty SPA entry',
  );
  const pages = (await readdir(directory, { recursive: true })).filter(
    (file) => file.endsWith('.html') && file !== 'index.html',
  );
  for (const page of pages) {
    const output = await readFile(path.join(directory, page), 'utf8');
    assert(
      output.includes('type="isodata"') && output.includes('data-page='),
      `landing/${page}: missing prerendered app`,
    );
  }
  assert(
    !html.includes('data-initial-loading'),
    'landing: startup must not cover prerendered content',
  );
  const assets = await readdir(path.join(directory, 'assets'));
  const scripts = assets.filter((name) => name.endsWith('.js'));
  assert(
    scripts.length > 0 && !scripts.some((name) => name.includes('-legacy-')),
    `${app}: invalid module output`,
  );
  for (const file of scripts) {
    const source = await readFile(path.join(directory, 'assets', file), 'utf8');
    parse(source, { ecmaVersion: 2020, sourceType: 'module' });
  }
  const inlineCss = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
    .map((match) => match[1])
    .join('\n');
  assert(
    inlineCss.includes('box-sizing:border-box') &&
      inlineCss.includes('font-size'),
    'landing: missing inline first-paint styles',
  );
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
  checkTheme(css, app);
  console.log(
    `${app}/${mode}: environment, static HTML, CSS and ${scripts.length} module scripts checked`,
  );
}

const appRoot = path.join(root, 'apps/agreement');
const directory = path.join(appRoot, 'dist');
const files = await readdir(directory, { recursive: true });
const pages = files.filter((file) => file.endsWith('.html'));
assert(pages.length > 0, 'agreement: missing document pages');
assert(
  !pages.includes('index.html'),
  'agreement: root page must not be published',
);
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
  assert(
    html.includes('type="module"') && !html.includes('id="vite-legacy-entry"'),
    `${page}: missing module hydration entry`,
  );
  assert(
    html.includes('type="isodata"') && !html.includes('ssr-outlet'),
    `${page}: missing prerendered hydration marker`,
  );
  for (const [, source] of html.matchAll(
    /<script\b[^>]*\b(?:src|data-src)="([^"]+)"/g,
  )) {
    assert(source.startsWith(base), `${page}: script has wrong base`);
    const script = source.slice(base.length);
    assert(
      files.includes(path.normalize(script)),
      `${page}: script file missing`,
    );
    scripts.add(script);
  }
  const head = /<head>([\s\S]*?)<\/head>/.exec(html)?.[1] ?? '';
  const styles = [...head.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(
    (match) => match[1],
  );
  inlineCss += styles.join('\n');
  assert(
    /<style\b[^>]*id="agreement-style"/.test(head) &&
      !/<link\b[^>]*rel="stylesheet"/.test(head),
    `${page}: agreement styles must be inline`,
  );
}
assert(scripts.size > 0, 'agreement: missing client entry');
for (const file of files.filter((file) => file.endsWith('.js'))) {
  parse(await readFile(path.join(directory, file), 'utf8'), {
    ecmaVersion: 2020,
    sourceType: 'module',
  });
}
assert(
  !files.some((file) => /runtime|\.map$|-legacy-/.test(file)),
  'agreement: old runtime artifacts must not be published',
);
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
checkTheme(css, 'agreement');
console.log(
  `agreement/${mode}: ${pages.length} HTML pages, environment, inline CSS and module hydration checked`,
);
