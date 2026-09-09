// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loading, toast, type Close } from '../packages/ui/src/index';

const cleanups: Close[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const close of cleanups.splice(0)) close();
  vi.runAllTimers();
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
    vi.advanceTimersByTime(141);
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
    vi.advanceTimersByTime(1640);
    expect(document.querySelector('.pkg-ui-toast')).toBeNull();
  });

  it('supports manual, idempotent dismissal with duration zero', () => {
    const close = toast('保持显示', { duration: 0 });
    cleanups.push(close);
    vi.runAllTimers();
    expect(document.querySelector('.pkg-ui-toast')).not.toBeNull();
    close();
    close();
    vi.runAllTimers();
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
    vi.advanceTimersByTime(120);
    closeA();
    closeA();
    expect(document.querySelectorAll('.pkg-ui-loading')).toHaveLength(1);
    expect(document.querySelector('.pkg-ui-loading')?.textContent).toBe(
      '任务 B',
    );
    closeB();
    vi.runAllTimers();
    expect(document.querySelector('.pkg-ui-loading')).toBeNull();
  });

  it('restores the previous pending message when the latest operation ends', () => {
    const closeA = loading('任务 A');
    const closeB = loading('任务 B');
    cleanups.push(closeA, closeB);
    vi.advanceTimersByTime(120);
    closeB();
    expect(document.querySelector('.pkg-ui-loading')?.textContent).toBe(
      '任务 A',
    );
    closeA();
    vi.runAllTimers();
    expect(document.querySelector('.pkg-ui-loading')).toBeNull();
    const closeNew = loading();
    cleanups.push(closeNew);
    vi.advanceTimersByTime(120);
    closeA();
    expect(document.querySelector('.pkg-ui-loading')?.textContent).toBe(
      '加载中…',
    );
  });

  it('reuses one element when toast replaces loading and never revives replaced loading', () => {
    const closeLoading = loading('<b>加载中</b>');
    cleanups.push(closeLoading);
    vi.advanceTimersByTime(120);
    const element = document.querySelector('.pkg-ui-loading');
    expect(element?.querySelector('b')).toBeNull();
    const closeToast = toast('成功', { duration: 0 });
    cleanups.push(closeToast);
    expect(document.querySelector('.pkg-ui-toast')).toBe(element);
    expect(
      document.querySelectorAll('.pkg-ui-loading, .pkg-ui-toast'),
    ).toHaveLength(1);
    closeLoading();
    expect(element?.textContent).toBe('成功');
    closeToast();
    vi.runAllTimers();
    expect(document.querySelector('.pkg-ui-notice')).toBeNull();
  });

  it('invalidates old toast timers and loading handles across mode changes', () => {
    const oldLoading = loading('旧任务');
    const oldToast = toast('旧提示', { duration: 1000 });
    const latest = loading('新任务');
    cleanups.push(oldLoading, oldToast, latest);
    oldLoading();
    oldToast();
    vi.advanceTimersByTime(2000);
    expect(document.querySelectorAll('.pkg-ui-notice')).toHaveLength(1);
    expect(document.querySelector('.pkg-ui-loading')?.textContent).toBe(
      '新任务',
    );
  });

  it('does not flash for work completed before the display delay', () => {
    const close = loading();
    cleanups.push(close);
    expect(document.querySelector('.pkg-ui-loading')).toBeNull();
    vi.advanceTimersByTime(100);
    close();
    vi.runAllTimers();
    expect(document.querySelector('.pkg-ui-loading')).toBeNull();
  });

  it('keeps the same spinner and card during consecutive work and fades out afterwards', () => {
    const first = loading('第一步');
    cleanups.push(first);
    vi.advanceTimersByTime(120);
    const card = document.querySelector('.pkg-ui-loading');
    const spinner = card?.querySelector('.pkg-ui-spinner');
    first();
    vi.advanceTimersByTime(100);
    expect(card?.classList.contains('pkg-ui-visible')).toBe(true);
    const second = loading('第二步');
    cleanups.push(second);
    expect(document.querySelector('.pkg-ui-loading')).toBe(card);
    expect(card?.querySelector('.pkg-ui-spinner')).toBe(spinner);
    vi.advanceTimersByTime(500);
    expect(card?.classList.contains('pkg-ui-visible')).toBe(true);
    second();
    expect(card?.classList.contains('pkg-ui-visible')).toBe(false);
    expect(card?.parentNode).toBe(document.body);
    vi.advanceTimersByTime(140);
    expect(card?.parentNode).toBeNull();
  });
  it('cancels a pending removal when a new toast arrives during fade-out', () => {
    const first = toast('旧提示', { duration: 0 });
    cleanups.push(first);
    const card = document.querySelector('.pkg-ui-notice');
    first();
    vi.advanceTimersByTime(70);
    const second = toast('新提示', { duration: 0 });
    cleanups.push(second);
    vi.advanceTimersByTime(500);
    expect(document.querySelector('.pkg-ui-toast')).toBe(card);
    expect(card?.classList.contains('pkg-ui-visible')).toBe(true);
    expect(card?.textContent).toBe('新提示');
  });
});
