import { expect, it } from 'vitest';
import { register } from './index';

it('imports safely without a browser and rejects registration clearly', () => {
  expect(typeof window).toBe('undefined');
  expect(() => register(() => {})).toThrow('document.body is ready');
});
