import { useErrorBoundary } from 'preact/hooks';
import { LocationProvider, Router, Route } from 'preact-iso';
import { useRouteLoading } from './hooks/use-route-loading';
import { routes } from './router/routes';
import { PageLoadError } from './components/page-load-error';

export function App() {
  const { startLoading, finishLoading } = useRouteLoading();
  const [error] = useErrorBoundary(finishLoading);
  if (error) return <PageLoadError />;

  return (
    <LocationProvider scope={import.meta.env.BASE_URL}>
      <Router onLoadStart={startLoading} onLoadEnd={finishLoading}>
        {routes.map(({ file, component, ...props }) => (
          <Route key={file} {...props} component={component} />
        ))}
      </Router>
    </LocationProvider>
  );
}
