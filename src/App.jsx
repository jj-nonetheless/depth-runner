import { onMount, onCleanup, Show } from 'solid-js';
import { attach } from './game/render.js';
import { press, releaseAll } from './game/input.js';
import { S } from './game/engine.js';
import { connect } from './net/room.js';
import { connectScores } from './net/scores.js';
import { screen, startLoop, startSolo, goLobby, goCpuRoles, goScores, goTitle, playAgain, leaveGame, notice } from './controller.js';
import Screens from './components/Screens.jsx';
import Pads from './components/Pads.jsx';
import Rules from './components/Rules.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import { look, setLook, toggleLook } from './look.js';

const GAME_KEYS = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

export default function App() {
  let canvas;
  onMount(() => {
    attach(canvas);
    startLoop();
    connect();
    connectScores();
  });

  const typing = (e) => e.target instanceof HTMLInputElement;
  const onKey = (e) => {
    if (typing(e)) return;
    if (e.code === 'KeyG') toggleLook();
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
      if (e.code === 'Digit4') goScores();
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
        <div class="head-right">
          <Show when={look() === '8'} fallback={<p class="tag"><span class="badge">16-BIT EDITION</span><span class="blink">PUSH START</span></p>}>
            <p class="load">LOAD "DEPTH RUNNER",1 &nbsp;<b>READY.</b> <span class="cursor" /></p>
          </Show>
          <div class="look" role="group" aria-label="Graphics">
            <button aria-pressed={look() === '8'} onClick={() => setLook('8')}>8-BIT</button>
            <button aria-pressed={look() === '16'} onClick={() => setLook('16')}>16-BIT</button>
          </div>
        </div>
      </header>

      <div class="frame">
        <div class="screen">
          <canvas ref={canvas} width="320" height="240" aria-label="Depth Runner game screen" />
          <Screens />
          <Show when={notice() && screen() !== 'play'}>
            <p class="notice" role="status">{notice()}</p>
          </Show>
        </div>
      </div>

      <Show when={screen() === 'play'}>
        <Pads />
      </Show>

      <section class="top10" aria-labelledby="top10-h">
        <h2 id="top10-h">Top 10</h2>
        <Leaderboard />
      </section>

      <Rules />
    </div>
  );
}
