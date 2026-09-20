import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export async function createLandingFixture(options: { rum?: boolean } = {}) {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const source = path.join(root, 'apps/landing');
  const directory = await mkdtemp(path.join(root, 'apps/.landing-ssg-'));
  const cleanup = () => rm(directory, { recursive: true, force: true });
  try {
    for (const file of [
      'src',
      'index.html',
      'package.json',
      'vite.config.ts',
    ]) {
      await cp(path.join(source, file), path.join(directory, file), {
        recursive: true,
        filter: (filename) => filename !== path.join(source, 'src/pages'),
      });
    }
    await cp(
      path.join(source, 'src/pages/[...path]'),
      path.join(directory, 'src/pages/[...path]'),
      { recursive: true },
    );
    await symlink(
      path.join(source, 'node_modules'),
      path.join(directory, 'node_modules'),
      'junction',
    );
    await writeFile(
      path.join(directory, '.env.prod'),
      'VITE_APP_ENV=prod\nVITE_BASE_PATH=/campaign/\n' +
        (options.rum
          ? 'VITE_ARMS_ENDPOINT=https://example.invalid/rum\nVITE_APP_VERSION=fixture\n'
          : ''),
    );
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({
        extends: '../../tsconfig.base.json',
        compilerOptions: { paths: { '@/*': ['./src/*'] } },
        include: ['src'],
      }),
    );
    for (const [name, source] of Object.entries({
      'start.tsx': `
        import { useEffect, useState } from 'preact/hooks';
        import { createProbeStore } from '../stores/probe';
        import './fixture.css';
        import './start.css';
        export const prerender = true;
        export default function Start() {
          const [store] = useState(createProbeStore);
          const [count, setCount] = useState(0);
          const [ready, setReady] = useState(false);
          useEffect(() => setReady(true), []);
          return <main class="fixture start" data-request={store.ready}><h1>静态首屏</h1><button disabled={!ready} onClick={() => setCount(count + 1)}>计数 {count}</button><a href="/campaign/offer/">活动</a><a href="/campaign/detail/7?channel=A">动态页</a><a href="/campaign/client/">客户端页面</a></main>;
        }`,
      'offer.tsx': `import './fixture.css'; import './offer.css'; export const prerender = true; export default function Offer() { return <main class="fixture offer"><h1>预渲染活动</h1><a href="/campaign/start/">起始页</a></main>; }`,
      'optional/[[id]]/index.tsx': `export default function Optional({ id }: { id?: string }) { return <main><h1>可选 {id ?? '空'}</h1></main>; }`,
      'files/[...path]/index.tsx': `export default function Files({ params }: { params: { path?: string } }) { return <main><h1>捕获 {params.path ?? '空'}</h1></main>; }`,
      'ignored.test.tsx': `throw new Error('Excluded page was evaluated'); export const prerender = 'not metadata';`,
      'client/index.tsx': `import './style.css'; export default function Client() { return <main class="client-only"><h1>客户端页面</h1><a href="/campaign/start/">起始页</a></main>; }`,
      'disabled/index.tsx': `export const prerender = false; export default function Disabled() { throw new Error('Not a prerendered page'); }`,
      'detail/[id]/index.tsx': `export default function Detail({ id, query }: { id: string; query: Record<string, string> }) { return <main><h1>动态 {id}</h1><p>{query.channel}</p></main>; }`,
    })) {
      const file = path.join(directory, 'src/pages', name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, source);
    }
    await mkdir(path.join(directory, 'src/stores/probe'));
    await writeFile(
      path.join(directory, 'src/stores/probe/index.ts'),
      `import { request } from '@/api'; export function createProbeStore() { return { ready: typeof request.raw === 'function' }; }`,
    );
    await writeFile(
      path.join(directory, 'src/pages/fixture.css'),
      '.fixture { padding: 17px; color: var(--primary); }',
    );
    for (const [name, css] of Object.entries({
      'start.css': '.start { border-top: 3px solid red; }',
      'offer.css':
        '.offer { border-top: 5px solid blue; background-image: url("/banner.svg"); }',
      'client/style.css': '.client-only { color: rgb(12, 34, 56); }',
    })) {
      await writeFile(path.join(directory, 'src/pages', name), css);
    }
    await mkdir(path.join(directory, 'public'));
    await writeFile(
      path.join(directory, 'public/banner.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    );
    await promisify(execFile)(
      process.execPath,
      [
        path.join(root, 'node_modules/vite/bin/vite.js'),
        'build',
        '--mode',
        'prod',
      ],
      {
        cwd: directory,
        env: { ...process.env, NODE_ENV: 'production' },
      },
    );
    return { directory, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
