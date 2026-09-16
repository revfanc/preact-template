declare module 'virtual:file-routes' {
  export const routes: Array<
    import('../../../../tooling/file-routes/types').FileRoute & {
      load: () => Promise<{ default: import('preact').ComponentType }>;
    }
  >;
}
