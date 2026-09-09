import { describe, expect, it } from 'vitest';
import { createFileRoutes } from '../apps/landing/src/router/file-routes';

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
