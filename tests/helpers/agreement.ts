import { execFile } from 'node:child_process';
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export async function createAgreementFixture() {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const source = path.join(root, 'apps/agreement');
  const directory = await mkdtemp(path.join(root, 'apps/.agreement-ssg-'));
  const cleanup = () => rm(directory, { recursive: true, force: true });
  try {
    for (const file of [
      'src',
      'index.html',
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
    ]) {
      await cp(path.join(source, file), path.join(directory, file), {
        recursive: true,
      });
    }
    await symlink(
      path.join(source, 'node_modules'),
      path.join(directory, 'node_modules'),
      'junction',
    );
    await writeFile(
      path.join(directory, '.env.prod'),
      'VITE_APP_ENV=prod\nVITE_BASE_PATH=/legal/\n',
    );
    await writeFile(
      path.join(directory, 'src/pages/terms.tsx'),
      `
      import { useEffect, useState } from 'preact/hooks';
      export const title = '条款 & <说明>';
      export default function Terms() {
        const [count, setCount] = useState(0);
        const [ready, setReady] = useState(false);
        useEffect(() => setReady(true), []);
        return <><h1 class="terms">静态正文</h1><button disabled={!ready} onClick={() => setCount(count + 1)}>计数 {count}</button></>;
      }
    `,
    );
    await writeFile(
      path.join(directory, 'src/pages/ignored.spec.tsx'),
      `throw new Error('Excluded page was evaluated'); export default () => null;`,
    );
    await writeFile(
      path.join(directory, 'src/style.css'),
      (await readFile(path.join(directory, 'src/style.css'), 'utf8')) +
        '\n.terms { padding: 17px; color: var(--primary); }',
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
