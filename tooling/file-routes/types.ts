export type FileRoute = { file: string } & (
  { path: string; default?: false } | { path?: never; default: true }
);

export interface RouteOptions {
  /** File suffixes, without the leading dot. Supports e.g. page.tsx. */
  extensions?: string[];
  /** Glob patterns relative to dir. */
  include?: string | string[];
  exclude?: string | string[];
  /** Filename (without extension) mapped to its parent path. */
  index?: string;
  /** Exact file relative to dir. No implicit 404 filename. */
  notFound?: string;
  dynamic?: boolean;
}

export interface FileRoutesOptions extends RouteOptions {
  dir?: string;
  importMode?: 'lazy' | 'eager';
}

/** Selected source file; discovery removes the configured extension. */
export interface PageFile {
  file: string;
  stem: string;
  default: boolean;
}
