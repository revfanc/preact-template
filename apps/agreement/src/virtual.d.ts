declare module 'virtual:file-routes/eager' {
  export const routes: Array<
    import('../../../tooling/file-routes/types').FileRoute & {
      page: { default: import('preact').ComponentType; title: string };
    }
  >;
}
