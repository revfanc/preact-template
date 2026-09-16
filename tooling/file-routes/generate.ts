import path from 'node:path';
import type { FileRoute, FileRoutesOptions } from './types.ts';

/** Only serializes imports and records; it does not interpret route patterns. */
export function generateModule(
  routes: FileRoute[],
  directory: string,
  mode: FileRoutesOptions['importMode'] = 'lazy',
): string {
  const imports: string[] = [];
  const entries = routes.map((route, index) => {
    const source = JSON.stringify(
      '/@fs/' + path.resolve(directory, route.file).replace(/\\/g, '/'),
    );
    if (mode === 'eager')
      imports.push(`import * as page${index} from ${source};`);
    const member =
      mode === 'eager' ? `page: page${index}` : `load: () => import(${source})`;
    return `{...${JSON.stringify(route)}, ${member}}`;
  });
  return `${imports.join('\n')}\nexport const routes = [${entries.join(',')}];`;
}
