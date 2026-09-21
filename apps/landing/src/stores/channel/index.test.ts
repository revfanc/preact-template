import { expect, it } from 'vitest';
import { createChannelStore, readChannelContext } from './index';

it('parses only channel context and never invents a default channel', () => {
  expect(
    readChannelContext(
      '?channelCode=A%2BB&undertakePageConfigId=10&clickid=x&linkId=y&token=secret',
    ),
  ).toEqual({
    channelCode: 'A+B',
    undertakePageConfigId: '10',
    clickid: 'x',
    linkId: 'y',
  });
  expect(readChannelContext('?linkId=old')).toBeNull();
  expect(readChannelContext('?channelCode=')).toBeNull();
  expect(() => readChannelContext('?channelCode=A&channelCode=B')).toThrow(
    'channelCode',
  );
});

it('owns an isolated, stable snapshot and clears stale context on missing or invalid input', () => {
  const store = createChannelStore();
  const other = createChannelStore();
  expect(store.getSnapshot()).toEqual({
    initialized: false,
    context: null,
    error: null,
  });
  store.sync('?channelCode=A&linkId=first');
  const first = store.getSnapshot();
  store.sync('?linkId=first&channelCode=A&irrelevant=1');
  expect(store.getSnapshot()).toBe(first);
  expect(other.getSnapshot().context).toBeNull();
  store.sync('?channelCode=B');
  expect(store.getSnapshot().context).toEqual({ channelCode: 'B' });
  store.sync('?channelCode=B&channelCode=C');
  expect(store.getSnapshot().context).toBeNull();
  expect(store.getSnapshot().error).toContain('channelCode');
  store.sync('');
  expect(store.getSnapshot()).toEqual({
    initialized: true,
    context: null,
    error: null,
  });
  store.dispose();
  store.sync('?channelCode=ignored');
  expect(store.getSnapshot().context).toBeNull();
});
