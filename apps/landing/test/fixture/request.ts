import {
  createBrowserRequestClient,
  createBrowserAbortController,
} from '@packages/request/browser';

const fixture = {
  client: createBrowserRequestClient({
    baseURL: '/landing/__request',
    headers: { 'x-client': 'fixture' },
  }),
  createController: createBrowserAbortController,
};

declare global {
  interface Window {
    requestFixture: typeof fixture;
  }
}

window.requestFixture = fixture;
