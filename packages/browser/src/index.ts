import type { BackHandler, RegisterOptions, Unregister } from './types';
import { Scope } from './scope';
export type { Done, BackHandler, Unregister, RegisterOptions } from './types';

let scope: Scope | undefined;

/** Register the current page's top Back handler; same-page handlers share one guard. */
export function register(
  handler: BackHandler,
  options: RegisterOptions = {},
): Unregister {
  if (typeof window === 'undefined' || !document.body) {
    throw new Error(
      '@packages/browser must be called after document.body is ready.',
    );
  }
  if (typeof handler !== 'function')
    throw new TypeError('A Back handler is required.');
  if (options.onError !== undefined && typeof options.onError !== 'function') {
    throw new TypeError('onError must be a function.');
  }
  if (scope && !scope.ownsCurrent()) {
    scope.stop();
    scope = undefined;
  }
  scope ??= new Scope();
  return scope.add(handler, options);
}
