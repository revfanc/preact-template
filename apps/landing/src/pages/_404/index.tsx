import { PageState } from '@packages/components';
import { useLocation } from 'preact-iso';

export default function NotFoundPage() {
  const { route } = useLocation();
  return (
    <PageState
      code="404"
      title="页面不存在"
      description="链接可能已失效，请返回首页继续浏览。"
      actionText="返回首页"
      onAction={() => route(import.meta.env.BASE_URL, true)}
    />
  );
}
