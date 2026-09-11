// @vitest-environment jsdom
import { render } from 'preact';
import { useErrorBoundary } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { expect, it, vi } from 'vitest';
import {
  AppStoresProvider,
  createAppStores,
  useAppStores,
  useStoreInstance,
  type AppStores,
} from '../index';

it('shares within an owner, survives page replacement and isolates separate application owners', () => {
  const host = document.createElement('div');
  const seen = new Map<string, AppStores>();
  const instances: AppStores[] = [];
  const disposers: Array<ReturnType<typeof vi.fn>> = [];
  function Consumer({ id }: { id: string }) {
    seen.set(id, useAppStores());
    return <span>{id}</span>;
  }
  function Owner({ page }: { page: string }) {
    const stores = useStoreInstance(() => {
      const registry = createAppStores();
      const dispose = vi.fn(registry.dispose);
      const instance = { ...registry, dispose };
      disposers.push(dispose);
      instances.push(instance);
      return instance;
    });
    return (
      <AppStoresProvider value={stores}>
        <Consumer key={page} id={page} />
        <Consumer id={`${page}-sibling`} />
      </AppStoresProvider>
    );
  }
  try {
    act(() =>
      render(
        <>
          <Owner page="p1" />
          <Owner page="other" />
        </>,
        host,
      ),
    );
    expect(seen.get('p1')).toBe(seen.get('p1-sibling'));
    expect(seen.get('p1')).not.toBe(seen.get('other'));
    act(() =>
      render(
        <>
          <Owner page="p2" />
          <Owner page="other" />
        </>,
        host,
      ),
    );
    expect(instances).toHaveLength(2);
    expect(seen.get('p2')).toBe(seen.get('p1'));
    disposers.forEach((dispose) => expect(dispose).not.toHaveBeenCalled());
  } finally {
    act(() => render(null, host));
  }
  disposers.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1));
});

it('bridges the same registry to an independent render root without owning its cleanup', () => {
  const pageHost = document.createElement('div');
  const modalHost = document.createElement('div');
  const dispose = vi.fn();
  const stores = { ...createAppStores(), dispose };
  const seen: AppStores[] = [];
  function Consumer() {
    seen.push(useAppStores());
    return null;
  }
  try {
    act(() =>
      render(
        <AppStoresProvider value={stores}>
          <Consumer />
        </AppStoresProvider>,
        pageHost,
      ),
    );
    act(() =>
      render(
        <AppStoresProvider value={stores}>
          <Consumer />
        </AppStoresProvider>,
        modalHost,
      ),
    );
    expect(seen).toEqual([stores, stores]);
    act(() => render(null, modalHost));
    expect(dispose).not.toHaveBeenCalled();
  } finally {
    act(() => render(null, modalHost));
    act(() => render(null, pageHost));
  }
  expect(dispose).not.toHaveBeenCalled();
});

it('fails explicitly without a provider instead of silently creating another registry', () => {
  const host = document.createElement('div');
  function Consumer() {
    useAppStores();
    return null;
  }
  function Boundary() {
    const [error] = useErrorBoundary();
    return error ? <span>{error.message}</span> : <Consumer />;
  }
  try {
    act(() => render(<Boundary />, host));
    expect(host.textContent).toBe(
      'useAppStores must be used within AppStoresProvider.',
    );
  } finally {
    act(() => render(null, host));
  }
});
