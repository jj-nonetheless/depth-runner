import { render } from 'solid-js/web';
import './look.js'; // sets the page's look before the first paint
import App from './App.jsx';
import './look8.css';
import './look16.css';
import './common.css';
import * as engine from './game/engine.js';
import * as controller from './controller.js';
import * as room from './net/room.js';
import { encode } from './game/snapshot.js';
import * as scores from './net/scores.js';
import { startPhase } from './components/StartScreen.jsx';
import { keys } from './game/input.js';

render(() => <App />, document.getElementById('root'));

// Hook for the browser tests (tests/*.mjs); only present when the URL has ?test.
if (new URLSearchParams(location.search).has('test')) {
  window.__dr = { ...engine, ...controller, ...room, ...scores, encode, startPhase, keys };
}
