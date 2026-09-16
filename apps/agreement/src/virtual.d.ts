declare module 'virtual:pages/eager' {
  export const pages: Array<
    import('../../../tooling/pages').PageEntry & {
      page: { default: import('preact').ComponentType; title: string };
    }
  >;
}
