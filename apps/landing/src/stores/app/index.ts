/** Own application-wide domain stores here, not one combined state snapshot. */
export function createAppStores() {
  return Object.freeze({
    dispose() {
      // No domain stores yet. Dispose owned stores here when they are added.
    },
  });
}

export type AppStores = ReturnType<typeof createAppStores>;
