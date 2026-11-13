// Menus drawn over the game canvas: title, lobby, picking sides, results.
import { Switch, Match, Show, For, onMount } from 'solid-js';
import {
  screen, against, result, startSolo, goLobby, goCpuRoles, goTitle,
  challenge, accept, decline, cancelChallenge, pickRole, setReady, playAgain,
} from '../controller.js';
import { net, mine, setNick, opponent, incoming, others } from '../net/room.js';

const focusFirst = (get) => onMount(() => get()?.querySelector('button')?.focus({ preventScroll: true }));

function Title() {
  let el;
  focusFirst(() => el);
  return (
    <section class="panel title" ref={el}>
      <h2 class="logo">DEPTH RUNNER</h2>
      <div class="menu">
        <button onClick={startSolo}><kbd>1</kbd> 1 PLAYER</button>
        <button onClick={goLobby}><kbd>2</kbd> 2 PLAYERS ONLINE</button>
        <button onClick={goCpuRoles}><kbd>3</kbd> 2 PLAYERS VS COMPUTER</button>
      </div>
    </section>
  );
}

const WHERE = { title: 'ON THE TITLE SCREEN', solo: 'PLAYING SOLO', lobby: 'IN THE LOBBY', roles: 'IN A MATCH', play: 'IN A MATCH', over: 'IN A MATCH' };

function Lobby() {
  const pending = () => (mine.inv ? net.peers.find((p) => p.peer === mine.inv) : null);
  const status = () => {
    if (net.status === 'connecting') return 'CONNECTING…';
    if (net.status === 'offline') return 'OFFLINE';
    const n = others().length;
    return `ONLINE · ${n} OTHER ${n === 1 ? 'PLAYER' : 'PLAYERS'} HERE`;
  };
  return (
    <section class="panel lobby" aria-label="Lobby">
      <div class="row between">
        <h2>LOBBY</h2>
        <span class={'status ' + net.status}>{status()}</span>
      </div>
      <label class="nick" for="nick">YOUR NAME
        <input id="nick" maxlength="12" autocomplete="off" value={mine.nick}
          onChange={(e) => setNick(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      </label>

      <Show when={net.status === 'offline'}>
        <p class="note">{net.reason}</p>
      </Show>

      <Show when={net.status === 'online'}>
        <For each={incoming()}>
          {(p) => (
            <div class="invite" role="alert">
              <span><b>{p.nick}</b> WANTS TO PLAY</span>
              <span class="row">
                <button class="go" onClick={() => accept(p.peer)}>ACCEPT</button>
                <button onClick={() => decline(p)}>DECLINE</button>
              </span>
            </div>
          )}
        </For>
        <Show when={pending()}>
          {(p) => (
            <div class="invite waiting">
              <span>WAITING FOR <b>{p().nick}</b> TO ACCEPT…</span>
              <button onClick={cancelChallenge}>CANCEL</button>
            </div>
          )}
        </Show>
        <ul class="players">
          <For each={others()} fallback={<li class="empty">NO ONE ELSE IS HERE YET. SEND SOMEONE THE LINK TO THIS PAGE.</li>}>
            {(p) => (
              <li>
                <span class="who">
                  <b>{p.nick}</b>
                  <small>{p.playing ? WHERE[p.st] : 'OPENING THE GAME'}{p.sameBrowser ? ' · YOUR OTHER TAB' : ''}</small>
                </span>
                <Show when={p.playing && p.st === 'lobby' && !mine.inv && p.inv !== net.me}>
                  <button onClick={() => challenge(p.peer)}>CHALLENGE</button>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <div class="row">
        <button onClick={goCpuRoles}>PLAY THE COMPUTER</button>
        <button onClick={goTitle}>BACK</button>
      </div>
    </section>
  );
}

function Side(props) {
  return (
    <button class={'side ' + props.role} aria-pressed={mine.role === props.role} onClick={() => pickRole(props.role)}>
      <span class="name">{props.role === 'sub' ? 'SUB' : 'SHIP'}</span>
      <small>{props.role === 'sub' ? 'Dodge the charges, torpedo the ship' : 'Hunt the sub with depth charges'}</small>
      <Show when={props.theirs}><em>{props.theirs} PICKED THIS</em></Show>
    </button>
  );
}

function Roles() {
  const o = () => (against() === 'remote' ? opponent() : null);
  const theirs = (role) => (o() && o().role === role ? o().nick : '');
  const state = () => {
    const op = o();
    if (!op) return null;
    if (op.st !== 'roles' && op.st !== 'play') return `${op.nick} IS STILL ON THE RESULTS SCREEN`;
    if (!mine.role) return 'PICK A SIDE';
    if (!op.role) return `WAITING FOR ${op.nick} TO PICK`;
    if (op.role === mine.role) return `YOU BOTH PICKED ${mine.role.toUpperCase()}. ONE OF YOU SWITCH.`;
    if (!mine.ready) return op.ready ? `${op.nick} IS READY` : 'PRESS READY WHEN SET';
    return op.ready ? 'STARTING…' : `WAITING FOR ${op.nick}…`;
  };
  const canReady = () => o() && mine.role && o().role && o().role !== mine.role;
  return (
    <section class="panel roles" aria-label="Pick your side">
      <h2>{against() === 'cpu' ? 'YOU VS COMPUTER' : `YOU VS ${o()?.nick ?? '…'}`}</h2>
      <p class="sub">PICK YOUR SIDE</p>
      <div class="sides">
        <Side role="sub" theirs={theirs('sub')} />
        <Side role="ship" theirs={theirs('ship')} />
      </div>
      <Show when={against() === 'remote'}>
        <p class="state" role="status">{state()}</p>
      </Show>
      <div class="row">
        <Show when={against() === 'remote'}>
          <button class="go" disabled={!canReady()} aria-pressed={mine.ready} onClick={() => setReady(!mine.ready)}>
            {mine.ready ? 'READY ✓' : 'READY'}
          </button>
          <button onClick={goLobby}>LEAVE MATCH</button>
        </Show>
        <Show when={against() === 'cpu'}>
          <button onClick={goTitle}>BACK</button>
        </Show>
      </div>
    </section>
  );
}

function Over() {
  let el;
  focusFirst(() => el);
  const r = () => result() || { mode: 1 };
  const online = () => against() === 'remote' && !r().oppLeft && !!opponent();
  return (
    <section class="panel over" ref={el}>
      <Show when={r().mode === 1} fallback={
        <>
          <h2 class={r().winner === 'SUB' ? 'c-sub' : 'c-boat'}>{r().winner} WINS!</h2>
          <p class={r().won ? 'big c-amber' : 'big c-red'}>{r().won ? 'YOU WIN' : 'YOU LOSE'}</p>
          <Show when={r().oppLeft}><p class="note">YOUR OPPONENT LEFT, SO THE COMPUTER FINISHED THE GAME.</p></Show>
        </>
      }>
        <h2 class="c-red">GAME OVER</h2>
        <p class="big">SCORE {r().score}</p>
        <p class="c-amber">HI {r().hi}</p>
      </Show>
      <div class="row">
        <Show when={r().mode === 1}>
          <button class="go" onClick={playAgain}>PLAY AGAIN</button>
        </Show>
        <Show when={r().mode === 2 && online()}>
          <button class="go" onClick={playAgain}>REMATCH</button>
          <button onClick={goLobby}>LOBBY</button>
        </Show>
        <Show when={r().mode === 2 && against() === 'cpu'}>
          <button class="go" onClick={playAgain}>PLAY AGAIN</button>
          <button onClick={goCpuRoles}>CHANGE SIDE</button>
        </Show>
        <Show when={r().mode === 2 && against() === 'remote' && !online()}>
          <button class="go" onClick={goLobby}>LOBBY</button>
        </Show>
        <button onClick={goTitle}>TITLE</button>
      </div>
    </section>
  );
}

export default function Screens() {
  return (
    <Switch>
      <Match when={screen() === 'title'}><Title /></Match>
      <Match when={screen() === 'lobby'}><Lobby /></Match>
      <Match when={screen() === 'roles'}><Roles /></Match>
      <Match when={screen() === 'over'}><Over /></Match>
    </Switch>
  );
}
