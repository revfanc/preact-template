export function createNotice(className: string): HTMLDivElement {
  if (typeof document === 'undefined' || !document.body) {
    throw new Error(
      '@packages/ui must be called after document.body is ready.',
    );
  }

  const element = document.createElement('div');
  element.className = `${className} no-rem`;
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  element.setAttribute('aria-atomic', 'true');
  return element;
}

export function removeNotice(element: HTMLElement): void {
  if (element.parentNode) element.parentNode.removeChild(element);
}
