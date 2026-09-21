import { useLocation } from 'preact-iso';
import { createHref } from '@/router/href';
import { useChannelStore } from '@/stores';

export function useNavigation() {
  const { url, route } = useLocation();
  const { state } = useChannelStore();
  function href(to: string) {
    // A build cannot know the visitor's query. Keep context-dependent links inactive until sync.
    if (!state.initialized || state.error) return undefined;
    return createHref(to, url);
  }
  function navigate(to: string, replace = false) {
    const target = href(to);
    if (!target) throw new Error('渠道上下文尚未初始化或参数无效');
    if (target.startsWith('//') || !target.startsWith(import.meta.env.BASE_URL))
      throw new Error(
        'navigate 仅支持当前应用内的地址，外部地址请使用普通链接',
      );
    route(target, replace);
  }
  return { href, navigate };
}
