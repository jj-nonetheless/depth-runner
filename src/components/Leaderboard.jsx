// The Top 10 table: everyone's scores (shared) or this device's.
import { createSignal, createMemo, For, Show } from 'solid-js';
import { board } from '../net/scores.js';

const date = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');

export default function Leaderboard(props) {
  const [tab, setTab] = createSignal(null); // null = pick automatically
  const which = createMemo(() => tab() ?? (board.status === 'offline' ? 'local' : 'shared'));
  const rows = () => (which() === 'shared' ? board.shared : board.local);
  const empty = () => {
    if (which() === 'shared' && board.status === 'loading') return 'LOADING THE TOP 10…';
    if (which() === 'shared' && board.status === 'offline') return 'THE SHARED TOP 10 ISN’T AVAILABLE HERE.';
    return 'NO SCORES YET. PLAY 1 PLAYER TO SET ONE.';
  };
  return (
    <div class={'board' + (props.compact ? ' compact' : '')}>
      <div class="tabs" role="tablist" aria-label="Which Top 10">
        <button role="tab" aria-selected={which() === 'shared'} onClick={() => setTab('shared')}>EVERYONE</button>
        <button role="tab" aria-selected={which() === 'local'} onClick={() => setTab('local')}>THIS DEVICE</button>
      </div>
      <ol class="scores">
        <For each={rows()} fallback={<li class="empty">{empty()}</li>}>
          {(e, i) => (
            <li classList={{ mine: !!e.mine, first: i() === 0 }}>
              <span class="rank">{String(i() + 1).padStart(2, '0')}</span>
              <span class="name">{e.name}</span>
              <span class="lv">LV{e.level}</span>
              <span class="pts">{String(e.score).padStart(6, '0')}</span>
              <Show when={!props.compact}><span class="when">{date(e.at)}</span></Show>
            </li>
          )}
        </For>
      </ol>
      <Show when={which() === 'shared' && board.note}>
        <p class="note">{board.note}</p>
      </Show>
    </div>
  );
}
