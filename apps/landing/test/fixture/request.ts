import { createRequestClient, createAbortController } from '@packages/request';

const fixture = {
  client: createRequestClient({
    baseURL: '/landing/__request',
    headers: { 'x-client': 'fixture' },
  }),
  createController: createAbortController,
};

declare global {
  interface Window {
    requestFixture: typeof fixture;
  }
}

window.requestFixture = fixture;
