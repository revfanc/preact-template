import { useErrorBoundary, useRef } from 'preact/hooks';
import { LocationProvider, Router, Route } from 'preact-iso';
import { useLoading } from '@/hooks/use-loading';
import { useChannel } from '@/hooks/use-channel';
import { routes } from '@/router/routes';
import { PageError } from '@/components/page-error';
import { AppStoresProvider, createAppStores, useStoreInstance } from '@/stores';

function ChannelInitializer() {
  useChannel();
  return null;
}

export function App({ hydrating = false }: { hydrating?: boolean }) {
  const initial = useRef(hydrating);
  const stores = useStoreInstance(createAppStores);
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
    <AppStoresProvider value={stores}>
      <LocationProvider scope={import.meta.env.BASE_URL}>
        <ChannelInitializer />
        <div data-page={location.pathname.replace(/\/$/, '') || '/'}>
          <Router
            onLoadStart={() => {
              if (!initial.current && typeof window !== 'undefined')
                startLoading();
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
      </LocationProvider>
    </AppStoresProvider>
  );
}
