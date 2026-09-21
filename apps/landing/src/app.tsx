import { useErrorBoundary, useRef } from 'preact/hooks';
import { LocationProvider, Router, Route } from 'preact-iso';
import { useLoading } from '@/hooks/use-loading';
import { useChannel } from '@/hooks/use-channel';
import { routes } from '@/router/routes';
import { PageError } from '@/components/page-error';
import { AppStoresProvider, createAppStores, useStoreInstance } from '@/stores';

export function App({ hydrating = false }: { hydrating?: boolean }) {
  const stores = useStoreInstance(createAppStores);
  return (
    <AppStoresProvider value={stores}>
      <LocationProvider scope={import.meta.env.BASE_URL}>
        <AppContent hydrating={hydrating} />
      </LocationProvider>
    </AppStoresProvider>
  );
}

function AppContent({ hydrating }: { hydrating: boolean }) {
  useChannel();
  const initial = useRef(hydrating);
  const { startLoading, finishLoading } = useLoading();
  const [error] = useErrorBoundary((error) => {
    finishLoading();
    console.error(error);
  });

  if (error) {
    return (
      <PageError
        title="页面暂时无法显示"
        description="页面遇到了一些问题，请重新加载后再试一次。"
      />
    );
  }

  return (
    <div data-page={location.pathname.replace(/\/$/, '') || '/'}>
      <Router
        onLoadStart={() => {
          if (!initial.current && typeof window !== 'undefined') startLoading();
        }}
        onLoadEnd={() => {
          initial.current = false;
          finishLoading();
        }}
      >
        {routes.map(({ file, component, ...props }) => (
          <Route key={file} {...props} component={component} />
        ))}
      </Router>
    </div>
  );
}
