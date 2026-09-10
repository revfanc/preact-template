import { PageState } from '@packages/components';

export function PageError() {
  return (
    <PageState
      role="alert"
      title="页面加载失败"
      description={'页面暂时没有打开。\n请检查网络连接后再试一次。'}
      actionText="重新加载页面"
      onAction={() => window.location.reload()}
    />
  );
}
