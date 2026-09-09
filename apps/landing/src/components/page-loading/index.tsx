import { pageLoadingHtml } from '@packages/ui/page-loading';

export function PageLoading() {
  return <div dangerouslySetInnerHTML={{ __html: pageLoadingHtml }} />;
}
