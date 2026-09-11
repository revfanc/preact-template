// @vitest-environment jsdom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { expect, it } from 'vitest';
import { useLocalRouteStore } from './hooks';

it('keeps bound route stores stable and isolated between owners and disposes them on unmount', () => {
  const host = document.createElement('div');
  const stores: Array<ReturnType<typeof useLocalRouteStore>['store']> = [];
  function Owner({ id }: { id: number }) {
    const { state, store } = useLocalRouteStore();
    stores[id] = store;
    return <span>{String(state.isLoading)}</span>;
  }
  try {
    act(() =>
      render(
        <>
          <Owner id={0} />
          <Owner id={1} />
        </>,
        host,
      ),
    );
    const first = stores[0]!;
    const second = stores[1]!;
    expect(first).not.toBe(second);
    act(() => first.start());
    expect(host.textContent).toBe('truefalse');
    expect(stores[0]).toBe(first);
    expect(stores[1]).toBe(second);
    act(() => second.start());
    expect(host.textContent).toBe('truetrue');
  } finally {
    act(() => render(null, host));
  }
  stores.forEach((store) => {
    store.start();
    expect(store.getSnapshot().isLoading).toBe(false);
  });
});
