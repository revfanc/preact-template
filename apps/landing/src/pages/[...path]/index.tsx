import { PageState } from '@packages/components';

export default function NotFoundPage() {
  return (
    <PageState
      code="404"
      title="页面不存在"
      description="链接可能已失效，请检查访问地址。"
    />
  );
}
