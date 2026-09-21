// @vitest-environment jsdom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { LocationProvider } from 'preact-iso';
import { expect, it, vi } from 'vitest';
import { AppStoresProvider, createAppStores, useChannelStore } from '@/stores';
import { useNavigation } from '@/hooks/use-navigation';
import { useChannel } from './index';

it('uses the static initial snapshot when a consumer mounts after URL initialization', () => {
  const host = document.createElement('div');
  const stores = createAppStores();
  stores.channel.sync('?channelCode=A');
  const snapshots: boolean[] = [];
  function Consumer() {
    const { state } = useChannelStore();
    snapshots.push(state.initialized);
    return (
      <button disabled={!state.initialized}>
        {state.context?.channelCode}
      </button>
    );
  }
  try {
    act(() =>
      render(
        <AppStoresProvider value={stores}>
          <Consumer />
        </AppStoresProvider>,
        host,
      ),
    );
    expect(snapshots[0]).toBe(false);
    expect(snapshots[snapshots.length - 1]).toBe(true);
    expect(host.querySelector('button')?.disabled).toBe(false);
    expect(stores.channel.getInitialSnapshot().context).toBeNull();
  } finally {
    act(() => render(null, host));
    stores.dispose();
  }
});

it('syncs URL context after mount, follows navigation and popstate, and never requests or persists data', () => {
  const host = document.createElement('div');
  const stores = createAppStores();
  let navigation!: ReturnType<typeof useNavigation>;
  const fetcher = vi.spyOn(globalThis, 'fetch');
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  const first: boolean[] = [];
  history.replaceState(
    null,
    '',
    '/landing/start/?channelCode=A&clickid=old&token=private',
  );
  function Initialize() {
    useChannel();
    return null;
  }
  function Page() {
    const { state } = useChannelStore();
    navigation = useNavigation();
    first.push(state.initialized);
    return (
      <a href={navigation.href('/landing/next/')}>
        {state.context?.channelCode ?? 'empty'}
      </a>
    );
  }
  try {
    act(() =>
      render(
        <AppStoresProvider value={stores}>
          <LocationProvider>
            <Initialize />
            <Page />
          </LocationProvider>
        </AppStoresProvider>,
        host,
      ),
    );
    expect(first[0]).toBe(false);
    expect(host.textContent).toBe('A');
    expect(host.querySelector('a')?.getAttribute('href')).toBe(
      '/landing/next/?channelCode=A&clickid=old',
    );
    const original = stores.channel.getSnapshot();
    act(() => navigation.navigate('/landing/next/'));
    expect(stores.channel.getSnapshot()).toBe(original);
    expect(location.search).toBe('?channelCode=A&clickid=old');
    act(() => navigation.navigate('/landing/next/?channelCode=B'));
    expect(stores.channel.getSnapshot().context).toEqual({ channelCode: 'B' });
    expect(location.search).toBe('?channelCode=B');
    act(() => {
      history.replaceState(
        null,
        '',
        '/landing/start/?channelCode=A&linkId=return',
      );
      dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(stores.channel.getSnapshot().context).toEqual({
      channelCode: 'A',
      linkId: 'return',
    });
    act(() => {
      history.replaceState(
        null,
        '',
        '/landing/start/?channelCode=X&channelCode=Y',
      );
      dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(stores.channel.getSnapshot().context).toBeNull();
    expect(host.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(() => navigation.navigate('/landing/next/')).toThrow('参数无效');
    act(() => {
      history.replaceState(null, '', '/landing/start/');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(stores.channel.getSnapshot().context).toBeNull();
    expect(stores.channel.getSnapshot().error).toBeNull();
    expect(() => navigation.navigate('//external.test/')).toThrow('当前应用');
    expect(fetcher).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
  } finally {
    act(() => render(null, host));
    stores.dispose();
    vi.restoreAllMocks();
    history.replaceState(null, '', '/');
  }
});
