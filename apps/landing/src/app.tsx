import { useErrorBoundary } from 'preact/hooks';
import { LocationProvider, Router, Route } from 'preact-iso';
import { useRouteLoading } from './hooks/use-route-loading';
import { routes } from './router/routes';
import { PageError } from './components/page-error';

export function App() {
  const { isLoading, startLoading, finishLoading } = useRouteLoading();
  const [error] = useErrorBoundary(finishLoading);
  if (error) return <PageError />;

  return (
    <LocationProvider scope={import.meta.env.BASE_URL}>
      <div hidden={isLoading}>
        <Router onLoadStart={startLoading} onLoadEnd={finishLoading}>
          {routes.map(({ file, component, ...props }) => (
            <Route key={file} {...props} component={component} />
          ))}
        </Router>
      </div>
    </LocationProvider>
  );
}
