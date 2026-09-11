// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLayoutEffect, useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { modal, ModalCancelledError, type ModalControls } from '../index';

const tasks: Array<{ close: () => void }> = [];
function flush() {
  act(() => {
    vi.runAllTimers();
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  tasks.splice(0).forEach((task) => task.close());
  flush();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = '';
  document.body.removeAttribute('style');
});

it('renders a stateful component and settles once after component cleanup', async () => {
  const unmount = vi.fn();
  function Content({ resolve, reject }: ModalControls<number>) {
    const [count, setCount] = useState(1);
    useLayoutEffect(() => unmount, []);
    return (
      <>
        <button data-add onClick={() => setCount(count + 1)}>
          增加 {count}
        </button>
        <button
          data-confirm
          onClick={() => {
            resolve(count);
            reject(new Error('late'));
            resolve(99);
          }}
        >
          确认
        </button>
      </>
    );
  }
  const task = modal<number>({
    render: (controls) => <Content {...controls} />,
  });
  tasks.push(task);
  act(() => {
    document.querySelector<HTMLButtonElement>('[data-add]')!.click();
  });
  expect(document.querySelector('[data-add]')!.textContent).toContain('2');
  act(() => {
    document.querySelector<HTMLButtonElement>('[data-confirm]')!.click();
  });
  expect(document.querySelector('[data-modal]')).not.toBeNull();
  flush();
  await expect(task).resolves.toBe(2);
  expect(unmount).toHaveBeenCalledOnce();
  expect(document.querySelector('[data-modal-root]')).toBeNull();
});

it('keeps lower modals mounted, closes the middle independently, and unlocks only after the last close', async () => {
  document.body.style.overflow = 'auto';
  const first = modal({ render: () => <input defaultValue="保留内容" /> });
  const middle = modal({ render: () => <p>中间</p> });
  const last = modal({ render: () => <p>栈顶</p> });
  tasks.push(first, middle, last);
  const outcomes = [
    first.catch((e) => e),
    middle.catch((e) => e),
    last.catch((e) => e),
  ];
  expect(document.querySelectorAll('[data-modal-overlay]')).toHaveLength(3);
  expect(
    document.querySelectorAll('[data-modal][aria-hidden="true"]'),
  ).toHaveLength(2);
  middle.close();
  middle.close();
  flush();
  expect(await outcomes[1]).toMatchObject({ reason: 'close' });
  expect(document.body.style.position).toBe('fixed');
  expect(document.querySelectorAll('[data-modal]')).toHaveLength(2);
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  );
  flush();
  expect(await outcomes[2]).toMatchObject({ reason: 'escape' });
  expect(document.querySelector('input')!.value).toBe('保留内容');
  first.close();
  flush();
  expect(await outcomes[0]).toBeInstanceOf(ModalCancelledError);
  expect(document.body.style.position).toBe('');
  expect(document.body.style.overflow).toBe('auto');
});

it('only accepts overlay clicks from the top layer and honors each overlay option', async () => {
  const first = modal({ closeOnClickOverlay: true, render: () => <p>一</p> });
  const second = modal({
    position: 'bottom',
    overlayStyle: { backgroundColor: 'rgb(1, 2, 3)' },
    render: () => <p>二</p>,
  });
  tasks.push(first, second);
  const one = first.catch((e) => e),
    two = second.catch((e) => e);
  const overlays = document.querySelectorAll<HTMLElement>(
    '[data-modal-overlay]',
  );
  overlays[0]!.click();
  overlays[1]!.click();
  flush();
  expect(document.querySelectorAll('[data-modal]')).toHaveLength(2);
  expect(overlays[1]!.style.backgroundColor).toBe('rgb(1, 2, 3)');
  expect(document.querySelector('[data-position="bottom"]')).not.toBeNull();
  second.close();
  flush();
  await two;
  overlays[0]!.click();
  flush();
  expect(await one).toMatchObject({ reason: 'overlay' });
});

it('rejects with the original component reason and uses a cancellation error when omitted', async () => {
  let controls!: ModalControls<void>;
  const task = modal({
    render: (value) => {
      controls = value;
      return <p>内容</p>;
    },
  });
  tasks.push(task);
  const reason = { code: 'invalid' };
  const result = task.catch((e) => e);
  controls.reject(reason);
  flush();
  expect(await result).toBe(reason);
  const cancel = modal({
    render: (value) => {
      controls = value;
      return <p>内容</p>;
    },
  });
  tasks.push(cancel);
  const cancelled = cancel.catch((e) => e);
  controls.reject();
  flush();
  expect(await cancelled).toMatchObject({
    name: 'ModalCancelledError',
    reason: 'cancel',
  });
});

it('rejects render failures and preserves another modal and its scroll lock', async () => {
  const first = modal({ render: () => <p>保留</p> });
  tasks.push(first);
  const firstResult = first.catch((e) => e);
  const error = new Error('Broken content');
  function Broken(): never {
    throw error;
  }
  const task = modal({ render: () => <Broken /> });
  tasks.push(task);
  const failure = task.catch((e) => e);
  await act(async () => {
    vi.runAllTimers();
  });
  expect(await failure).toBe(error);
  expect(document.querySelectorAll('[data-modal]')).toHaveLength(1);
  expect(document.body.style.position).toBe('fixed');
  first.close();
  flush();
  await firstResult;
});

it('consumes overlay click, wheel and touch movement without bubbling into page handlers', async () => {
  const task = modal({ render: () => <p>内容</p> });
  tasks.push(task);
  const result = task.catch((error) => error);
  const background = vi.fn();
  document.body.addEventListener('click', background);
  const overlay = document.querySelector<HTMLElement>('[data-modal-overlay]')!;
  overlay.click();
  const wheel = new Event('wheel', { bubbles: true, cancelable: true });
  const touch = new Event('touchmove', { bubbles: true, cancelable: true });
  overlay.dispatchEvent(wheel);
  overlay.dispatchEvent(touch);
  expect(background).not.toHaveBeenCalled();
  expect(wheel.defaultPrevented).toBe(true);
  expect(touch.defaultPrevented).toBe(true);
  expect(document.querySelector('[data-modal]')).not.toBeNull();
  document.body.removeEventListener('click', background);
  task.close();
  flush();
  await result;
});

it('notifies render content of closing before unmounting without resetting its state', async () => {
  const states: boolean[] = [];
  let controls!: ModalControls<number>;
  const task = modal<number>({
    render: (value) => {
      controls = value;
      states.push(value.closing);
      return <input defaultValue="保留" />;
    },
  });
  tasks.push(task);
  const input = document.querySelector('input');
  expect(states).toEqual([false]);
  act(() => {
    controls.resolve(1);
  });
  expect(states).toEqual([false, true]);
  expect(document.querySelector('input')).toBe(input);
  flush();
  await expect(task).resolves.toBe(1);
});
