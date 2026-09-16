import type { FunctionComponent } from 'preact';
import { PageState } from '@packages/components';

export const PageError: FunctionComponent<{
  title?: string;
  description?: string;
}> = ({
  title = '页面加载失败',
  description = '页面暂时没有打开。\n请检查网络连接后再试一次。',
}) => {
  return (
    <PageState
      role="alert"
      title={title}
      description={description}
      actionText="重新加载页面"
      onAction={() => window.location.reload()}
    />
  );
};
