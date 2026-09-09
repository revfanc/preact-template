// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loading, toast, type Close } from '../packages/ui/src/index';

const cleanups: Close[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const close of cleanups.splice(0)) close();
  vi.clearAllTimers();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('toast', () => {
  it('shows plain text and closes after the default two seconds', () => {
    cleanups.push(toast('操作成功'));
    expect(document.querySelector('.pkg-ui-toast')?.textContent).toBe(
      '操作成功',
    );
    vi.advanceTimersByTime(1999);
    expect(document.querySelector('.pkg-ui-toast')).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(document.querySelector('.pkg-ui-toast')).toBeNull();
  });

  it('replaces the previous toast without letting its timer or close handle dismiss the new one', () => {
    const closeOld = toast('旧提示', { duration: 1000 });
    cleanups.push(closeOld);
    vi.advanceTimersByTime(500);
    cleanups.push(toast('新提示', { duration: 2000 }));
    closeOld();
    vi.advanceTimersByTime(500);
    expect(document.querySelectorAll('.pkg-ui-toast')).toHaveLength(1);
    expect(document.querySelector('.pkg-ui-toast')?.textContent).toBe('新提示');
    vi.advanceTimersByTime(1500);
    expect(document.querySelector('.pkg-ui-toast')).toBeNull();
  });

  it('supports manual, idempotent dismissal with duration zero', () => {
    const close = toast('保持显示', { duration: 0 });
    cleanups.push(close);
    vi.runAllTimers();
    expect(document.querySelector('.pkg-ui-toast')).not.toBeNull();
    close();
    close();
    expect(document.querySelector('.pkg-ui-toast')).toBeNull();
  });

  it('rejects invalid durations before replacing an existing toast', () => {
    cleanups.push(toast('原提示', { duration: 0 }));
    for (const duration of [-1, NaN, Infinity]) {
      expect(() => toast('无效提示', { duration })).toThrow(RangeError);
    }
    expect(document.querySelector('.pkg-ui-toast')?.textContent).toBe('原提示');
  });

  it('does not interpret HTML or steal focus', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    const message = '<img src=x onerror=alert(1)>';
    cleanups.push(toast(message));
    const notice = document.querySelector('.pkg-ui-toast');
    expect(notice?.textContent).toBe(message);
    expect(notice?.querySelector('img')).toBeNull();
    expect(notice?.getAttribute('role')).toBe('status');
    expect(document.activeElement).toBe(button);
  });
});

describe('loading', () => {
  it('keeps concurrent operations visible until their own handles are closed', () => {
    const closeA = loading('任务 A');
    const closeB = loading('任务 B');
    cleanups.push(closeA, closeB);
    closeA();
    closeA();
    expect(document.querySelectorAll('.pkg-ui-loading')).toHaveLength(1);
    expect(document.querySelector('.pkg-ui-loading')?.textContent).toBe(
      '任务 B',
    );
    closeB();
    expect(document.querySelector('.pkg-ui-loading')).toBeNull();
  });

  it('restores the previous pending message when the latest operation ends', () => {
    const closeA = loading('任务 A');
    const closeB = loading('任务 B');
    cleanups.push(closeA, closeB);
    closeB();
    expect(document.querySelector('.pkg-ui-loading')?.textContent).toBe(
      '任务 A',
    );
    closeA();
    expect(document.querySelector('.pkg-ui-loading')).toBeNull();
    const closeNew = loading();
    cleanups.push(closeNew);
    closeA();
    expect(document.querySelector('.pkg-ui-loading')?.textContent).toBe(
      '加载中…',
    );
  });

  it('is independent from toast and safely displays text', () => {
    const closeLoading = loading('<b>加载中</b>');
    const closeToast = toast('提示');
    cleanups.push(closeLoading, closeToast);
    closeToast();
    expect(document.querySelector('.pkg-ui-loading')?.textContent).toBe(
      '<b>加载中</b>',
    );
    expect(document.querySelector('.pkg-ui-loading b')).toBeNull();
    closeLoading();
    expect(document.querySelector('.pkg-ui-loading')).toBeNull();
  });
});
