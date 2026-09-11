// @vitest-environment jsdom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { expect, it, vi } from 'vitest';
const { loading, close } = vi.hoisted(() => {
  const close = vi.fn();
  return { close, loading: vi.fn(() => close) };
});
vi.mock('@packages/feedback', () => ({ loading }));
import { useRouteLoading } from './use-route-loading';

it('owns feedback, closes immediately, keeps callbacks stable and ignores starts after unmount', () => {
  const host = document.createElement('div');
  let route!: ReturnType<typeof useRouteLoading>;
  function Owner() {
    route = useRouteLoading();
    return <span>{String(route.isLoading)}</span>;
  }
  try {
    act(() => render(<Owner />, host));
    const start = route.startLoading;
    const finish = route.finishLoading;
    act(() => {
      start();
      start();
      expect(loading).toHaveBeenCalledExactlyOnceWith({ mask: true });
    });
    expect(host.textContent).toBe('true');
    expect(route.startLoading).toBe(start);
    expect(route.finishLoading).toBe(finish);
    act(() => {
      finish();
      finish();
      expect(close).toHaveBeenCalledTimes(1);
    });
    expect(host.textContent).toBe('false');
    act(() => start());
  } finally {
    act(() => render(null, host));
  }
  expect(close).toHaveBeenCalledTimes(2);
  route.startLoading();
  route.finishLoading();
  expect(loading).toHaveBeenCalledTimes(2);
  expect(close).toHaveBeenCalledTimes(2);
});
