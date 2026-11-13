import { onMount, onCleanup, Show } from 'solid-js';
import { attach } from './game/render.js';
import { press, releaseAll } from './game/input.js';
import { S } from './game/engine.js';
import { connect } from './net/room.js';
import { screen, startLoop, startSolo, goLobby, goCpuRoles, goTitle, playAgain, leaveGame, notice } from './controller.js';
import Screens from './components/Screens.jsx';
import Pads from './components/Pads.jsx';
import Rules from './components/Rules.jsx';

const GAME_KEYS = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

export default function App() {
  let canvas;
  onMount(() => {
    attach(canvas);
    startLoop();
    connect();
  });

  const typing = (e) => e.target instanceof HTMLInputElement;
  const onKey = (e) => {
    if (typing(e)) return;
    const s = screen();
    if (s === 'play') {
      if (GAME_KEYS.includes(e.code)) e.preventDefault();
      press(e.code, true);
      if (e.code === 'KeyP' && S.opp !== 'remote') S.paused = !S.paused;
      if (e.code === 'Escape') leaveGame();
      return;
    }
    if (e.code === 'Escape' && s !== 'title') { goTitle(); return; }
    if (s === 'title') {
      if (e.code === 'Digit1') startSolo();
      if (e.code === 'Digit2') goLobby();
      if (e.code === 'Digit3') goCpuRoles();
    }
    if (s === 'over' && e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) playAgain();
  };
  const onKeyUp = (e) => press(e.code, false);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
  onCleanup(() => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', releaseAll);
  });

  return (
    <div class="wrap">
      <header>
        <h1>DEPTH RUNNER</h1>
        <p class="load">LOAD "DEPTH RUNNER",1 &nbsp;<b>READY.</b> <span class="cursor" /></p>
      </header>

      <div class="frame">
        <div class="screen">
          <canvas ref={canvas} width="160" height="120" aria-label="Depth Runner game screen" />
          <Screens />
          <Show when={notice() && screen() !== 'play'}>
            <p class="notice" role="status">{notice()}</p>
          </Show>
        </div>
      </div>

      <Show when={screen() === 'play'}>
        <Pads />
      </Show>

      <Rules />
    </div>
  );
}
