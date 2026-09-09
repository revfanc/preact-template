// preact-iso uses composedPath for link clicks. Older Chrome provides event.path;
// the parent-chain fallback covers the template's light DOM on older Safari.
if (typeof Event.prototype.composedPath !== 'function') {
  Object.defineProperty(Event.prototype, 'composedPath', {
    configurable: true,
    writable: true,
    value(this: Event & { path?: EventTarget[] }): EventTarget[] {
      if (this.path) return this.path.slice();
      const path: EventTarget[] = [];
      let node = this.target as Node | null;
      while (node) {
        path.push(node);
        node = node.parentNode;
      }
      if (path[path.length - 1] === document) path.push(window);
      return path;
    },
  });
}
