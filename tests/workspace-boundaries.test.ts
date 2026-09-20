import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve, matchesGlob } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
interface Workspace {
  name: string;
  directory: string;
  kind: 'apps' | 'packages';
  exports?: Record<string, unknown>;
  dependencies: Record<string, string>;
}
const workspaces: Workspace[] = (['apps', 'packages'] as const).flatMap(
  (kind) =>
    readdirSync(resolve(root, kind), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => {
        const directory = resolve(root, kind, entry.name);
        const manifest = JSON.parse(
          readFileSync(resolve(directory, 'package.json'), 'utf8'),
        );
        return {
          name: manifest.name,
          directory,
          kind,
          exports: manifest.exports,
          dependencies: {
            ...manifest.dependencies,
            ...manifest.devDependencies,
            ...manifest.peerDependencies,
          },
        };
      }),
);
const inside = (file: string, directory: string) => {
  const path = relative(directory, file);
  return path === '' || (!path.startsWith('..') && !path.includes(':'));
};

function violation(owner: Workspace, file: string, specifier: string) {
  const spec = specifier.split('?')[0]!;
  if (/^(virtual:|node:|https?:|data:)/.test(spec)) return;
  if (owner.kind === 'packages' && spec.startsWith('@/'))
    return 'application alias in a package';
  const name = spec.startsWith('@')
    ? spec.split('/').slice(0, 2).join('/')
    : spec.split('/')[0]!;
  const target = workspaces.find((workspace) => workspace.name === name);
  if (target) {
    if (target.kind === 'apps' && target !== owner)
      return 'application is not a shared dependency';
    if (!owner.dependencies[name]) return 'undeclared workspace dependency';
    const subpath = spec === name ? '.' : '.' + spec.slice(name.length);
    if (
      !Object.keys(target.exports ?? {}).some((key) =>
        matchesGlob(subpath, key),
      )
    )
      return 'private package entry';
    return;
  }
  if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/')) {
    const configFile = resolve(owner.directory, 'tsconfig.json');
    const config = ts.readConfigFile(
      existsSync(configFile) ? configFile : resolve(root, 'tsconfig.base.json'),
      ts.sys.readFile,
    );
    const { options } = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      owner.directory,
    );
    const resolved =
      ts.resolveModuleName(spec, file, options, ts.sys).resolvedModule
        ?.resolvedFileName ??
      (spec.startsWith('@/')
        ? resolve(owner.directory, 'src', spec.slice(2))
        : resolve(dirname(file), spec));
    if (file.endsWith('.d.ts') && inside(resolved, resolve(root, 'tooling')))
      return;
    if (!inside(resolved, owner.directory))
      return 'source import crosses workspace boundary';
    if (inside(resolved, resolve(owner.directory, 'test')))
      return 'production source imports test fixture';
    return;
  }
  if (!owner.dependencies[name]) return 'undeclared dependency';
}

it('keeps production imports within workspace boundaries and public exports', () => {
  const failures: string[] = [];
  for (const workspace of workspaces) {
    const source = resolve(workspace.directory, 'src');
    if (!existsSync(source)) continue;
    for (const entry of readdirSync(source, { recursive: true }).map(String)) {
      if (
        !/\.(?:[cm]?[jt]sx?|css)$/.test(entry) ||
        /\.(?:test|spec)\./.test(entry)
      )
        continue;
      const file = resolve(source, entry);
      const text = readFileSync(file, 'utf8');
      const imports = entry.endsWith('.css')
        ? [...text.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map(
            (match) => match[1]!,
          )
        : ts.preProcessFile(text).importedFiles.map((item) => item.fileName);
      for (const specifier of imports) {
        const error = violation(workspace, file, specifier);
        if (error)
          failures.push(`${relative(root, file)} -> ${specifier}: ${error}`);
      }
    }
  }
  expect(failures).toEqual([]);
});

it('rejects cross-app imports, package back-dependencies, deep imports and undeclared dependencies', () => {
  const landing = workspaces.find(
    (workspace) => workspace.name === '@apps/landing',
  )!;
  const feedback = workspaces.find(
    (workspace) => workspace.name === '@packages/feedback',
  )!;
  const file = resolve(landing.directory, 'src/probe.ts');
  for (const specifier of [
    '../../agreement/src/app',
    '@apps/agreement',
    '@packages/feedback/src/index',
    'undeclared-lib',
  ]) {
    expect(violation(landing, file, specifier), specifier).toBeTruthy();
  }
  expect(violation(landing, file, '@packages/feedback')).toBeUndefined();
  expect(
    violation(
      feedback,
      resolve(feedback.directory, 'src/probe.ts'),
      '@/stores',
    ),
  ).toBeTruthy();
  expect(
    violation(
      feedback,
      resolve(feedback.directory, 'src/probe.ts'),
      '../../../apps/landing/src/app',
    ),
  ).toBeTruthy();
});

it('has no circular workspace dependencies or application dependencies', () => {
  const visit = (workspace: Workspace, chain: string[]) => {
    expect(
      chain,
      `Dependency cycle: ${[...chain, workspace.name].join(' -> ')}`,
    ).not.toContain(workspace.name);
    for (const target of workspaces.filter(
      (item) => workspace.dependencies[item.name],
    )) {
      expect(
        target.kind,
        `${workspace.name} depends on application ${target.name}`,
      ).toBe('packages');
      expect(workspace.dependencies[target.name]).toMatch(/^workspace:/);
      visit(target, [...chain, workspace.name]);
    }
  };
  for (const workspace of workspaces) visit(workspace, []);
});
