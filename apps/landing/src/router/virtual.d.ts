declare module 'virtual:pages' {
  export const prerenderPaths: string[];
  export const pages: Array<
    import('../../../../tooling/pages').PageEntry & {
      load: () => Promise<{ default: import('preact').ComponentType }>;
    }
  >;
}
