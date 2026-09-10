const KEY = '__packages_browser__';

export interface Marker {
  version: 1;
  pair: string;
  kind: 'base' | 'guard';
  url: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function readMarker(): Marker | undefined {
  const state: unknown = history.state;
  const value = isObject(state) ? state[KEY] : undefined;
  if (
    isObject(value) &&
    value.version === 1 &&
    typeof value.pair === 'string' &&
    value.pair.length > 0 &&
    (value.kind === 'base' || value.kind === 'guard') &&
    value.url === location.href
  )
    return value as unknown as Marker;
}

/** Adopt a refreshed guard, or start a new pair and discard its forward branch. */
export function protect(): Marker {
  const original: unknown = history.state;
  if (original !== null && !isObject(original)) {
    throw new TypeError(
      '@packages/browser requires null or plain-object history.state.',
    );
  }
  const existing = readMarker();
  if (original && KEY in original && !existing) {
    throw new Error(
      '@packages/browser found an invalid or incompatible history marker.',
    );
  }
  if (existing?.kind === 'guard') return existing;
  const marker: Marker = {
    version: 1,
    pair: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    kind: 'base',
    url: location.href,
  };
  const state = { ...original, [KEY]: marker };
  history.replaceState(state, '', marker.url);
  const guard: Marker = { ...marker, kind: 'guard' };
  try {
    history.pushState({ ...state, [KEY]: guard }, '', marker.url);
  } catch (error) {
    history.replaceState(original, '', marker.url);
    throw error;
  }
  return guard;
}
