// preact-iso uses Object.fromEntries, which is newer than our browser targets.
import 'core-js/es/object/from-entries';
import { render } from 'preact';
import { App } from './app';
import './style.css';

render(<App />, document.getElementById('app')!);
