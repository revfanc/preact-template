// @vitest-environment jsdom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { expect, it, vi } from 'vitest';
import {
  createStore,
  useStore,
  useStoreInstance,
  useRouteStore,
} from './index';

it('shares one owned instance between consumers, rerenders snapshots, and only the owner disposes', () => {
  const host = document.createElement('div');
  const instance = createStore({ count: 0 });
  const dispose = vi.spyOn(instance, 'dispose');
  const factory = vi.fn(() => instance);
  function Consumer() {
    const state = useStore(instance);
    return <span>{state.count}</span>;
  }
  function Owner({ second = true }: { second?: boolean }) {
    useStoreInstance(factory);
    return (
      <>
        <Consumer />
        {second && <Consumer />}
      </>
    );
  }
  try {
    act(() => render(<Owner />, host));
    act(() => instance.update(() => ({ count: 2 })));
    expect(host.textContent).toBe('22');
    act(() => render(<Owner second={false} />, host));
    expect(dispose).not.toHaveBeenCalled();
    expect(factory).toHaveBeenCalledTimes(1);
    act(() => instance.update(() => ({ count: 3 })));
    expect(host.textContent).toBe('3');
  } finally {
    act(() => render(null, host));
  }
  expect(dispose).toHaveBeenCalledTimes(1);
  instance.update(() => ({ count: 4 }));
  expect(instance.getSnapshot().count).toBe(3);
});

it('keeps bound route stores stable and isolated between owners and disposes them on unmount', () => {
  const host = document.createElement('div');
  const stores: Array<ReturnType<typeof useRouteStore>['store']> = [];
  function Owner({ id }: { id: number }) {
    const { state, store } = useRouteStore();
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
