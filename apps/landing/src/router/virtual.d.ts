declare module 'virtual:pages' {
  export const pages: Array<
    import('../../../../tooling/pages').PageEntry & {
      load: () => Promise<{ default: import('preact').ComponentType }>;
    }
  >;
}
