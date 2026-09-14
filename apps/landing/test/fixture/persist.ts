import { createStore, persistStore } from '@/stores/core';

const query = new URLSearchParams(window.location.search);
const store = createStore({ name: '', pending: false });
const errors: string[] = [];
const persistence = persistStore(store, {
  key: `fixture:draft:${query.get('channel') || 'A'}`,
  version: 1,
  pick: ['name'],
  storage: () =>
    query.get('storage') === 'local'
      ? window.localStorage
      : window.sessionStorage,
  validate: (value): value is { name: string } =>
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string',
  onError: (error) => {
    errors.push(String(error));
  },
});

const fixture = { store, persistence, errors };
declare global {
  interface Window {
    persistenceFixture: typeof fixture;
  }
}
window.persistenceFixture = fixture;
