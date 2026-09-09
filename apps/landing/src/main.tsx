import './polyfills';
import { render } from 'preact';
import { loading } from '@packages/ui';
import { App } from './app';
import './style.css';

// Adopt the HTML indicator before Preact starts; route/request handles take over.
const finishStartup = loading({ mask: true });
try {
  render(<App />, document.getElementById('app')!);
} finally {
  finishStartup();
}
