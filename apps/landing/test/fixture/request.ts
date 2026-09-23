import { createRequestClient, createAbortController } from '@packages/request';
import { request, BusinessError, ResponseFormatError } from '../../src/request';

const fixture = {
  business: request.create({ baseURL: '/landing/__request' }),
  BusinessError,
  ResponseFormatError,
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
