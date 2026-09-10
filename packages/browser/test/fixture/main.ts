import { register, type Done, type Unregister } from '../../src/index';

type Mode = 'hold' | 'allow' | 'defer' | 'throw';
const handles = new Map<string, Unregister>();
const calls: string[] = [];
const errors: string[] = [];
let currentDone: Done | undefined;
let finish: (() => void) | undefined;
let completed = 0;
let restoredFromCache = false;

function add(name: string, mode: Mode = 'hold') {
  const off = register(
    (done) => {
      calls.push(name);
      currentDone = done;
      if (mode === 'allow')
        return done().then(() => {
          completed++;
        });
      if (mode === 'defer')
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      if (mode === 'throw') throw new Error('fixture callback failure');
    },
    { onError: (error) => errors.push(String(error)) },
  );
  handles.set(name, off);
}

const fixture = {
  add,
  async remove(name: string) {
    const off = handles.get(name);
    handles.delete(name);
    await off?.();
  },
  async allow() {
    if (!currentDone) throw new Error('No Back callback');
    await currentDone();
    completed++;
    finish?.();
    finish = undefined;
  },
  status() {
    return {
      calls: calls.slice(),
      errors: errors.slice(),
      completed,
      restoredFromCache,
      state: history.state as Record<string, unknown> | null,
      length: history.length,
    };
  },
};

declare global {
  interface Window {
    browserFixture: typeof fixture;
  }
}
window.browserFixture = fixture;
function autoRegister() {
  const query = new URLSearchParams(location.search);
  const mode = query.get('auto');
  if (mode === 'allow' || mode === 'hold' || mode === 'defer') {
    add(query.get('name') || 'page', mode);
  }
}
autoRegister();
window.addEventListener('pagehide', () => handles.clear());
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    restoredFromCache = true;
    autoRegister();
  }
});
