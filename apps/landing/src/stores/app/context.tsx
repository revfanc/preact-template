import { createContext, type ComponentChildren } from 'preact';
import type { AppStores } from './index';

export const AppStoresContext = createContext<AppStores | undefined>(undefined);

/** Supplies an existing instance; only its creator owns disposal. */
export function AppStoresProvider({
  value,
  children,
}: {
  value: AppStores;
  children: ComponentChildren;
}) {
  return (
    <AppStoresContext.Provider value={value}>
      {children}
    </AppStoresContext.Provider>
  );
}
