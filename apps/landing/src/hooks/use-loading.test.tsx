// @vitest-environment jsdom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { expect, it, vi } from 'vitest';
const { loading, close } = vi.hoisted(() => {
  const close = vi.fn();
  return { close, loading: vi.fn(() => close) };
});
vi.mock('@packages/feedback', () => ({ loading }));
import { useLoading } from './use-loading';

it('owns feedback, closes immediately, keeps callbacks stable and ignores starts after unmount', () => {
  const host = document.createElement('div');
  let feedbackState!: ReturnType<typeof useLoading>;
  function Owner() {
    feedbackState = useLoading();
    return <span>{String(feedbackState.isLoading)}</span>;
  }
  try {
    act(() => render(<Owner />, host));
    const start = feedbackState.startLoading;
    const finish = feedbackState.finishLoading;
    act(() => {
      start();
      start();
      expect(loading).toHaveBeenCalledExactlyOnceWith({ mask: true });
    });
    expect(host.textContent).toBe('true');
    expect(feedbackState.startLoading).toBe(start);
    expect(feedbackState.finishLoading).toBe(finish);
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
  feedbackState.startLoading();
  feedbackState.finishLoading();
  expect(loading).toHaveBeenCalledTimes(2);
  expect(close).toHaveBeenCalledTimes(2);
});
