import { expect, it } from 'vitest';
import { createHref } from './href';

const from =
  '/landing/p1/entry/?channelCode=A&undertakePageConfigId=10&clickid=ad&linkId=link&token=secret&code=once';

it('carries only the context whitelist from the current URL, respecting base, target query and hash', () => {
  const result = new URL(
    createHref('p2/next/?order=3#form', from, '/landing/'),
    'https://test.invalid',
  );
  expect(result.pathname).toBe('/landing/p2/next/');
  expect(result.hash).toBe('#form');
  expect(Object.fromEntries(result.searchParams)).toEqual({
    order: '3',
    channelCode: 'A',
    undertakePageConfigId: '10',
    clickid: 'ad',
    linkId: 'link',
  });
  expect(createHref('/landing/p2/?linkId=new', from, '/landing/')).toContain(
    'linkId=new',
  );
  expect(
    createHref('next/', '/campaign/start/?channelCode=A', '/campaign/'),
  ).toBe('/campaign/next/?channelCode=A');
});

it('does not leak previous attribution when the destination explicitly changes or clears the channel', () => {
  expect(createHref('p2/?channelCode=B', from, '/landing/')).toBe(
    '/landing/p2/?channelCode=B',
  );
  expect(createHref('p2/?channelCode=', from, '/landing/')).toBe(
    '/landing/p2/?channelCode=',
  );
  expect(createHref('p2/', '/landing/start/', '/landing/')).toBe(
    '/landing/p2/',
  );
  expect(() =>
    createHref('p2/', '/landing/?channelCode=A&channelCode=B', '/landing/'),
  ).toThrow('channelCode');
});

it('never adds channel parameters to external URLs, other apps or paths escaping the app base', () => {
  for (const to of [
    'https://external.test/next',
    '//external.test/next',
    'mailto:help@example.test',
    '/agreement/privacy-policy/',
    '../agreement/privacy-policy/',
  ]) {
    expect(createHref(to, from, '/landing/')).not.toContain('channelCode');
  }
  expect(createHref('/landing-other/', from, '/landing/')).toBe(
    '/landing-other/',
  );
  expect(() => createHref('javascript:alert(1)', from, '/landing/')).toThrow(
    '导航协议',
  );
});

it('preserves normal fragment and query-only navigation semantics', () => {
  expect(createHref('#ideas', from, '/landing/')).toBe(from + '#ideas');
  const result = new URL(
    createHref('?step=2#form', from, '/landing/'),
    'https://test.invalid',
  );
  expect(result.pathname).toBe('/landing/p1/entry/');
  expect(result.searchParams.get('channelCode')).toBe('A');
  expect(result.searchParams.has('token')).toBe(false);
});
