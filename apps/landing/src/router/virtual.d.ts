declare module 'virtual:file-routes' {
  export const routes: Array<
    import('../../build/routes/patterns').FileRoute & {
      load: () => Promise<{ default: import('preact').ComponentType }>;
    }
  >;
}
