// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act } from 'preact/test-utils';
import { useLayoutEffect } from 'preact/hooks';
import { AsyncModalContent, modal, ModalCancelledError } from '../index';

const tasks: Array<{ close: () => void }> = [];
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function open(load: () => Promise<string>, timeout = 1000) {
  const task = modal<string>({
    render: (controls) => (
      <AsyncModalContent
        controls={controls}
        load={load}
        timeout={timeout}
        render={(text, current) => (
          <button onClick={() => current.resolve(text)}>{text}</button>
        )}
      />
    ),
  });
  tasks.push(task);
  const result = task.catch((error) => error);
  return { task, result };
}
function click(text: string) {
  const button = Array.from(document.querySelectorAll('button')).find(
    (node) => node.textContent === text,
  )!;
  act(() => button.click());
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  act(() => tasks.splice(0).forEach((task) => task.close()));
  act(() => {
    vi.runAllTimers();
  });
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

it('keeps one overlay and the result pending until the loaded content resolves', async () => {
  const load = deferred<string>();
  const { result } = open(() => load.promise);
  const settled = vi.fn();
  void result.then(settled);
  const overlay = document.querySelector('[data-modal-overlay]');
  expect(document.querySelector('[role="status"]')).not.toBeNull();
  await act(async () => load.resolve('确认'));
  expect(document.querySelector('[data-modal-overlay]')).toBe(overlay);
  expect(settled).not.toHaveBeenCalled();
  click('确认');
  act(() => {
    vi.runAllTimers();
  });
  expect(await result).toBe('确认');
});

it('shows a recoverable error, retries only once for repeated clicks, and does not duplicate overlays', async () => {
  const first = deferred<string>(),
    second = deferred<string>();
  const load = vi
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  open(load);
  await act(async () => first.reject(new Error('offline')));
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
  const button = Array.from(document.querySelectorAll('button')).find(
    (node) => node.textContent === '重试',
  )!;
  act(() => {
    button.click();
    button.click();
  });
  expect(load).toHaveBeenCalledTimes(2);
  await act(async () => second.resolve('成功'));
  expect(document.querySelectorAll('[data-modal-overlay]')).toHaveLength(1);
  expect(document.body.textContent).toContain('成功');
});

it('ignores a timed-out attempt after a retry succeeds', async () => {
  const first = deferred<string>(),
    second = deferred<string>();
  open(
    vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise),
  );
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(document.body.textContent).toContain('加载超时');
  click('重试');
  await act(async () => second.resolve('新内容'));
  await act(async () => first.resolve('过期内容'));
  expect(document.body.textContent).toContain('新内容');
  expect(document.body.textContent).not.toContain('过期内容');
});

it.each(['resolve', 'reject'] as const)(
  'ignores late %s after closing starts',
  async (outcome) => {
    const load = deferred<string>();
    const { task, result } = open(() => load.promise);
    // Close and finish loading in the same turn, before the closing render flushes.
    await act(async () => {
      task.close();
      load[outcome]('迟到内容');
    });
    expect(document.body.textContent).not.toContain('迟到内容');
    act(() => {
      vi.runAllTimers();
    });
    expect(await result).toBeInstanceOf(ModalCancelledError);
    expect(document.querySelector('[data-modal-root]')).toBeNull();
  },
);

it('lets the default loading and failure views cancel', async () => {
  const first = open(() => new Promise(() => {}));
  click('取消');
  act(() => {
    vi.runAllTimers();
  });
  expect(await first.result).toBeInstanceOf(ModalCancelledError);
  const second = open(() => {
    throw new Error('sync');
  });
  await act(async () => {});
  click('关闭');
  act(() => {
    vi.runAllTimers();
  });
  expect(await second.result).toBeInstanceOf(ModalCancelledError);
});

it('supports custom fallbacks and rejecting with the original loading error', async () => {
  const failure = new Error('missing chunk');
  const load = deferred<string>();
  const task = modal({
    render: (controls) => (
      <AsyncModalContent
        controls={controls}
        load={() => load.promise}
        loading={<span>自定义等待</span>}
        render={() => <span>内容</span>}
        renderError={({ error, reject }) => (
          <button onClick={() => reject(error)}>退出</button>
        )}
      />
    ),
  });
  tasks.push(task);
  const result = task.catch((error) => error);
  expect(document.body.textContent).toContain('自定义等待');
  await act(async () => load.reject(failure));
  click('退出');
  act(() => {
    vi.runAllTimers();
  });
  expect(await result).toBe(failure);
});

it('does not mount late content even briefly while closing, and cancels timers', async () => {
  const load = deferred<string>();
  const mounted = vi.fn();
  function Content() {
    useLayoutEffect(mounted, []);
    return <span>内容</span>;
  }
  const task = modal({
    render: (controls) => (
      <AsyncModalContent
        controls={controls}
        load={() => load.promise}
        render={() => <Content />}
      />
    ),
  });
  tasks.push(task);
  const result = task.catch((error) => error);
  await act(async () => {
    task.close();
    load.resolve('完成');
  });
  act(() => {
    vi.runAllTimers();
  });
  expect(await result).toBeInstanceOf(ModalCancelledError);
  expect(mounted).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps loaded content mounted with closing controls until the modal exit finishes', async () => {
  const load = vi.fn().mockResolvedValue('完成');
  const unmount = vi.fn();
  function Content({ closing }: { closing: boolean }) {
    useLayoutEffect(() => unmount, []);
    return <span>{closing ? '退场' : '就绪'}</span>;
  }
  const task = modal({
    render: (controls) => (
      <AsyncModalContent
        controls={controls}
        load={load}
        render={(_, current) => <Content closing={current.closing} />}
      />
    ),
  });
  tasks.push(task);
  const result = task.catch((error) => error);
  await act(async () => {});
  expect(document.body.textContent).toContain('就绪');
  act(() => task.close());
  expect(document.body.textContent).toContain('退场');
  expect(unmount).not.toHaveBeenCalled();
  act(() => {
    vi.runAllTimers();
  });
  await result;
  expect(unmount).toHaveBeenCalledOnce();
  expect(load).toHaveBeenCalledOnce();
});

it('treats a loaded component render failure as terminal rather than a retryable import failure', async () => {
  const failure = new Error('broken render');
  function Broken(): never {
    throw failure;
  }
  const task = modal({
    render: (controls) => (
      <AsyncModalContent
        controls={controls}
        load={() => Promise.resolve(true)}
        render={() => <Broken />}
      />
    ),
  });
  tasks.push(task);
  const result = task.catch((error) => error);
  await act(async () => {});
  act(() => {
    vi.runAllTimers();
  });
  expect(await result).toBe(failure);
  expect(document.querySelector('[data-modal-root]')).toBeNull();
});
