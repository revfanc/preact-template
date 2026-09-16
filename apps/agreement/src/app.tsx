import type { ComponentChildren } from 'preact';

export function App({ children }: { children: ComponentChildren }) {
  return <main>{children}</main>;
}
