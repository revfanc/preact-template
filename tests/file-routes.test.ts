import { describe, expect, it } from 'vitest';
import { createPageFiles } from '../tooling/file-routes/files';
import { resolveRoutes } from '../tooling/file-routes/resolve';
import type { RouteOptions } from '../tooling/file-routes/types';

// Exercise the public conventions through selection and parsing together.
function createRouteResolver(options: RouteOptions = {}) {
  const files = createPageFiles(options);
  return {
    resolve: (sources: string[]) =>
      resolveRoutes(
        sources.flatMap((source) => {
          const page = files.match(source);
          return page ? [page] : [];
        }),
        options,
      ),
  };
}
const createFileRoutes = createRouteResolver({
  include: '**/index.tsx',
  exclude: '**/_*/**',
  notFound: '_404/index.tsx',
}).resolve;

describe('file routes', () => {
  it('maps index pages, parameters and catch-all pages, ignoring private files', () => {
    const routes = createFileRoutes([
      'index.tsx',
      'result/index.tsx',
      'detail/index.tsx',
      'detail/[id]/index.tsx',
      'docs/[...path]/index.tsx',
      '_404/index.tsx',
      '_parts/card/index.tsx',
      'detail/_card/index.tsx',
      'detail/demo.test.tsx',
      'detail/demo.spec.tsx',
      'readme.md',
      'result.tsx',
      'detail/view.tsx',
      '_404.tsx',
      'p1/p2026090901/index.tsx',
      'p1/p2026090901/result/index.tsx',
    ]);
    expect(routes).toEqual(
      expect.arrayContaining([
        { file: 'index.tsx', path: '/' },
        { file: 'p1/p2026090901/index.tsx', path: '/p1/p2026090901' },
        {
          file: 'p1/p2026090901/result/index.tsx',
          path: '/p1/p2026090901/result',
        },
        { file: 'result/index.tsx', path: '/result' },
        { file: 'detail/index.tsx', path: '/detail' },
        { file: 'detail/[id]/index.tsx', path: '/detail/:id' },
        { file: 'docs/[...path]/index.tsx', path: '/docs/:path+' },
        { file: '_404/index.tsx', default: true },
      ]),
    );
    expect(routes).toHaveLength(8);
  });

  it('orders static segments before parameters, catch-all and 404 regardless of input order', () => {
    const files = [
      '_404/index.tsx',
      'detail/[...path]/index.tsx',
      'detail/[id]/index.tsx',
      'detail/new/index.tsx',
      '[page]/index.tsx',
    ];
    const expected = [
      'detail/new/index.tsx',
      'detail/[id]/index.tsx',
      'detail/[...path]/index.tsx',
      '[page]/index.tsx',
      '_404/index.tsx',
    ];
    expect(createFileRoutes(files).map((route) => route.file)).toEqual(
      expected,
    );
    expect(
      createFileRoutes(files.reverse()).map((route) => route.file),
    ).toEqual(expected);
  });

  it.each([
    ['detail/[id]/index.tsx', 'detail/[slug]/index.tsx'],
    ['docs/[...path]/index.tsx', 'docs/[...parts]/index.tsx'],
  ])('rejects conflicting routes %s and %s', (a, b) => {
    expect(() => createFileRoutes([a, b])).toThrow('Conflicting page routes');
  });

  it.each([
    '[...path]/edit/index.tsx',
    '[[id]]/index.tsx',
    '[id]/[id]/index.tsx',
    'bad name/index.tsx',
  ])('rejects unsupported or ambiguous file %s', (file) => {
    expect(() => createFileRoutes([file])).toThrow();
  });
});

it('supports flat files, folder pages, custom extensions and index names', () => {
  expect(
    createRouteResolver().resolve([
      'index.tsx',
      'about.jsx',
      'account/settings.tsx',
    ]),
  ).toEqual(
    expect.arrayContaining([
      { file: 'index.tsx', path: '/' },
      { file: 'about.jsx', path: '/about' },
      { file: 'account/settings.tsx', path: '/account/settings' },
    ]),
  );
  expect(
    createRouteResolver({ extensions: ['page.ts'], index: 'home' }).resolve([
      'home.page.ts',
      'docs/home.page.ts',
      'docs/topic.page.ts',
      'helper.ts',
    ]),
  ).toEqual(
    expect.arrayContaining([
      { file: 'home.page.ts', path: '/' },
      { file: 'docs/home.page.ts', path: '/docs' },
      { file: 'docs/topic.page.ts', path: '/docs/topic' },
    ]),
  );
  expect(createRouteResolver().resolve(['docs\\index.tsx'])).toEqual([
    { file: 'docs/index.tsx', path: '/docs' },
  ]);
});

it('uses glob selection and explicit fallback instead of special filenames', () => {
  const resolver = createRouteResolver({
    include: ['**/*.tsx'],
    exclude: ['private/**', '**/*.test.tsx'],
    notFound: 'private/missing.tsx',
  });
  expect(
    resolver.resolve([
      'about.tsx',
      'about.test.tsx',
      'private/card.tsx',
      'private/missing.tsx',
      '_404.tsx',
    ]),
  ).toEqual(
    expect.arrayContaining([
      { file: 'about.tsx', path: '/about' },
      { file: '_404.tsx', path: '/_404' },
      { file: 'private/missing.tsx', default: true },
    ]),
  );
  expect(resolver.resolve(['about.test.tsx', 'private/card.tsx'])).toEqual([]);
});

it('rejects file/folder conflicts and dynamic routes in static mode', () => {
  expect(() =>
    createRouteResolver().resolve(['about.tsx', 'about/index.jsx']),
  ).toThrow('Conflicting page routes');
  expect(() =>
    createRouteResolver().resolve(['[id].tsx', '[name]/index.tsx']),
  ).toThrow('Conflicting page routes');
  expect(() =>
    createRouteResolver({ dynamic: false }).resolve(['[id].tsx']),
  ).toThrow('concrete prerender paths');
  expect(() =>
    createRouteResolver({ dynamic: false }).resolve(['[...path].tsx']),
  ).toThrow('concrete prerender paths');
});
