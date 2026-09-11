import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, 'apps/landing/src');
const stores = resolve(source, 'stores');
const config = ts.readConfigFile(
  resolve(root, 'tsconfig.json'),
  ts.sys.readFile,
);
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const normalize = (path: string) => path.replace(/\\/g, '/');
const files = readdirSync(stores, { recursive: true })
  .map(String)
  .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
  .map((file) => resolve(stores, file));

it('keeps store imports within their layer and out of the consumer barrel', () => {
  const violations: string[] = [];
  for (const file of files) {
    const name = normalize(relative(stores, file));
    if (name === 'index.ts') continue; // The consumer entry intentionally assembles layers.
    const domain = name.split('/')[0];
    const adapter = /\/(hooks\.ts|context\.tsx)$/.test(name);
    for (const dependency of ts.preProcessFile(readFileSync(file, 'utf8'))
      .importedFiles) {
      const specifier = dependency.fileName;
      const resolved = ts.resolveModuleName(specifier, file, options, ts.sys)
        .resolvedModule?.resolvedFileName;
      const target = resolved
        ? normalize(relative(source, resolved))
        : specifier;
      const inStores = target.startsWith('stores/');
      const targetDomain = inStores ? target.split('/')[1] : undefined;
      const ui =
        /^(preact|react|react-dom|preact-iso|@packages\/(feedback|components))(\/|$)/.test(
          specifier,
        ) ||
        /^(components|pages|router|hooks)\//.test(target) ||
        /^\.\.\/\.\.\/\.\.\/packages\/(feedback|components)\//.test(target) ||
        /\.(css|astro)$/.test(specifier);
      const adapterTarget = /\/(hooks\.ts|context\.tsx)$/.test(target);
      if (
        target === 'stores/index.ts' ||
        (!adapter && (ui || adapterTarget)) ||
        (domain === 'core' && inStores && targetDomain !== 'core') ||
        (domain !== 'app' &&
          domain !== 'core' &&
          !adapter &&
          targetDomain === 'app')
      ) {
        violations.push(`${name} -> ${specifier}`);
      }
    }
  }
  expect(
    violations,
    'Store data must stay independent of UI and app ownership; internal files must not import the consumer barrel.',
  ).toEqual([]);
});

it('defines store hooks only in hooks.ts and keeps Context files declarative', () => {
  const violations: string[] = [];
  for (const file of files) {
    const name = normalize(relative(stores, file));
    if (name.endsWith('/hooks.ts')) continue;
    const ast = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node) => {
      if (
        ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) &&
          node.name &&
          ts.isIdentifier(node.name) &&
          /^use[A-Z]/.test(node.name.text)) ||
        (name.endsWith('/context.tsx') &&
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          /^use[A-Z]/.test(node.expression.text))
      ) {
        violations.push(`${name}: ${node.getText(ast).split('\n')[0]}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  expect(
    violations,
    'Put store hooks in hooks.ts; Context and Provider only pass existing instances.',
  ).toEqual([]);
});
