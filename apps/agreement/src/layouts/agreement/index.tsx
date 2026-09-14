import type { ComponentChildren } from 'preact';

export default function AgreementLayout({
  children,
}: {
  children: ComponentChildren;
}) {
  return <main>{children}</main>;
}
