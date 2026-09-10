import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parse } from 'acorn';

const mode = process.env.BUILD_MODE ?? process.argv[2] ?? 'test';
assert(['test', 'prod'].includes(mode), 'Use test or prod mode');
const root = new URL(`../dist/${mode}/`, import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
assert(html.includes('vite-legacy-entry') && html.includes('type="module"'));
const files = (await readdir(new URL('assets/', root))).filter(
  (name) => name.includes('-legacy-') && name.endsWith('.js'),
);
assert(files.length >= 2, 'Missing legacy entry or polyfills');
for (const file of files) {
  parse(await readFile(new URL(`assets/${file}`, root), 'utf8'), {
    ecmaVersion: 2015,
    sourceType: 'script',
  });
}
console.log(
  `browser/${mode}: dual entries and ${files.length} ES2015 legacy scripts checked`,
);
