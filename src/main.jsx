import { render } from 'solid-js/web';
import App from './App.jsx';
import './styles.css';
import * as engine from './game/engine.js';
import * as controller from './controller.js';
import * as room from './net/room.js';
import { encode } from './game/snapshot.js';

render(() => <App />, document.getElementById('root'));

// Hook for the browser tests (tests/*.mjs); only present when the URL has ?test.
if (new URLSearchParams(location.search).has('test')) {
  window.__dr = { ...engine, ...controller, ...room, encode };
}
