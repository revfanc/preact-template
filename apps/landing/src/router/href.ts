import { channelQueryKeys, readChannelContext } from '@/stores/channel';

/** Bare paths resolve from the app base; rooted paths keep their normal URL meaning. */
export function createHref(
  to: string,
  from: string,
  base = import.meta.env.BASE_URL,
) {
  const origin = 'https://landing.invalid';
  const root = new URL(base, origin);
  const current = new URL(from || root.pathname, root);
  const target = new URL(to, /^[?#]/.test(to) ? current : root);
  if (!['https:', 'http:', 'mailto:', 'tel:'].includes(target.protocol))
    throw new Error('不支持的导航协议');
  if (target.origin !== origin) return to;
  if (
    current.origin === origin &&
    current.pathname.startsWith(root.pathname) &&
    target.pathname.startsWith(root.pathname)
  ) {
    const context = readChannelContext(current.search);
    // An explicit new (or empty) channel starts a new context, without old attribution.
    if (
      context &&
      (!target.searchParams.has('channelCode') ||
        target.searchParams.get('channelCode')?.trim() === context.channelCode)
    ) {
      for (const key of channelQueryKeys) {
        const value = context[key];
        if (value && !target.searchParams.has(key))
          target.searchParams.set(key, value);
      }
    }
  }
  return target.pathname + target.search + target.hash;
}
