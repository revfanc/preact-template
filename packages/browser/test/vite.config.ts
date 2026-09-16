import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { buildTargets } from '../../../tooling/compatibility.ts';

// An isolated acceptance fixture: never shipped as part of either application.
export default defineConfig(({ mode }) => {
  const buildMode =
    process.env.BUILD_MODE ?? (mode === 'production' ? 'test' : mode);
  if (buildMode !== 'test' && buildMode !== 'prod')
    throw new Error('Use test or prod mode');
  return {
    root: fileURLToPath(new URL('./fixture', import.meta.url)),
    build: {
      outDir: fileURLToPath(new URL(`../dist/${buildMode}`, import.meta.url)),
      emptyOutDir: true,
      target: buildTargets,
      cssTarget: buildTargets,
    },
    preview: { host: '127.0.0.1', port: 4175, strictPort: true },
  };
});
