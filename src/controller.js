// Screen flow and the game loop.
//   title -> play (1 player)
//   title -> lobby -> roles -> play -> over -> roles (rematch) | lobby
//   title -> roles (vs computer) -> play -> over
// In an online match the sub player's page runs the game and shares snapshots;
// the ship player's page sends its keys and draws what it receives.
import { createSignal, createEffect, createRoot, untrack } from 'solid-js';
import { S, newGame, step, stepParts, cpuTakeover, setMsg, loadHi } from './game/engine.js';
import { aiShip, aiSub, resetAi } from './game/ai.js';
import { encode, apply } from './game/snapshot.js';
import { controls, idle } from './game/input.js';
import { P } from './game/constants.js';
import { draw } from './game/render.js';
import { startJingle } from './game/sound.js';
import {
  net, mine, setMine, sendPresence, opponent, declinedBy, peerGone, opponentPresence, challengeId,
} from './net/room.js';

export const [screen, setScreen] = createSignal('title');
export const [against, setAgainst] = createSignal('cpu'); // who the roles screen is for: 'cpu' | 'remote'
export const [notice, setNotice] = createSignal('');
export const [result, setResult] = createSignal(null); // { mode, winner, won, score, oppLeft }

let guest = { gid: -1, lastEv: 0 };
let sentKeys = -1;
let n = 0;
let oppNick = '';

const flash = (text) => { setNotice(text); setTimeout(() => { if (notice() === text) setNotice(''); }, 4000); };

// ---------- navigation
function stopOnline() {
  S.record = false;
  sendPresence({ s: null, in: null });
}
export function goTitle() {
  stopOnline();
  S.phase = 'idle';
  setMine({ st: 'title', inv: null, no: null, ready: false });
  setScreen('title');
}
export function startSolo() {
  stopOnline();
  setMine({ st: 'solo', inv: null, ready: false });
  newGame({ mode: 1 });
  startJingle();
  setScreen('play');
}
export function goLobby() {
  stopOnline();
  S.phase = 'idle';
  setMine({ st: 'lobby', inv: null, no: null, ready: false });
  setScreen('lobby');
}
export function goCpuRoles() {
  stopOnline();
  S.phase = 'idle';
  setMine({ st: 'roles', inv: null, ready: false });
  setAgainst('cpu');
  setScreen('roles');
}
function enterRoles() {
  S.phase = 'idle';
  setMine({ st: 'roles', ready: false });
  setAgainst('remote');
  setScreen('roles');
}

// ---------- lobby actions
export const challenge = (peer) => setMine({ inv: peer, at: Date.now(), no: null });
export const accept = (peer) => setMine({ inv: peer, at: Date.now(), no: null });
export const decline = (p) => setMine({ no: challengeId(p.peer, p.at) });
export const cancelChallenge = () => setMine({ inv: null });

// ---------- roles
export function pickRole(role) {
  setMine({ role, ready: false });
  if (against() === 'cpu') startCpu(role);
}
export const setReady = (ready) => setMine({ ready });

function startCpu(role) {
  newGame({ mode: 2, myRole: role, opp: 'cpu' });
  resetAi();
  setMine({ st: 'play', ready: false });
  setMsg('VS COMPUTER', P.txt, 150);
  startJingle();
  setScreen('play');
}
function startOnline(o) {
  oppNick = o.nick;
  const host = mine.role === 'sub';
  newGame({ mode: 2, myRole: mine.role, opp: 'remote' });
  resetAi();
  S.record = host;
  guest = { gid: -1, lastEv: 0 };
  sentKeys = -1;
  setMine({ st: 'play' });
  setMsg('VS ' + o.nick, P.txt, 150);
  startJingle();
  setScreen('play');
  if (host) sendPresence({ s: encode(), in: null });
}

// ---------- end of a game
function finish() {
  const oppLeft = S.mode === 2 && against() === 'remote' && S.opp === 'cpu';
  setResult({
    mode: S.mode,
    winner: S.winner,
    won: S.mode === 2 && S.winner === S.myRole.toUpperCase(),
    score: S.score,
    hi: S.hi,
    oppLeft,
  });
  setMine({ st: 'over', ready: false });
  setScreen('over');
}
export function playAgain() {
  const r = result();
  if (!r || r.mode === 1) return startSolo();
  if (against() === 'cpu' || r.oppLeft || !opponent()) {
    if (against() === 'remote') return goLobby();
    return startCpu(S.myRole);
  }
  enterRoles();
}
export function leaveGame() {
  if (S.mode === 2 && against() === 'remote') goLobby(); else goTitle();
}

// ---------- one 1/60 s tick
function takeover() {
  setMine({ inv: null });
  stopOnline();
  cpuTakeover(oppNick + ' LEFT - CPU ON');
}
function tick() {
  n++;
  if (S.phase !== 'play' && S.phase !== 'over') return;
  if (S.mode === 2 && S.opp === 'remote') {
    const o = opponentPresence();
    if (!o) {
      if (S.phase === 'play') takeover();
    } else if (S.myRole === 'ship') {
      // guest: send keys when they change, draw the host's latest snapshot
      const k = controls('ship');
      const code = (k.l ? 1 : 0) + (k.r ? 2 : 0) + (k.a ? 4 : 0);
      if (code !== sentKeys) { sentKeys = code; sendPresence({ in: k }); }
      if (apply(o.s, guest) === 'over') finish();
      if (S.msg.t > 0) S.msg.t--;
      stepParts();
      return;
    }
  }
  const before = S.phase;
  const theirKeys = () => {
    const o = opponentPresence();
    const i = o && o.in;
    return i && typeof i === 'object' ? { l: !!i.l, r: !!i.r, a: !!i.a } : idle;
  };
  const subCtl = S.mode === 2 && S.myRole === 'ship' ? aiSub() : controls('sub');
  const shipCtl = S.mode === 1 ? idle : S.myRole === 'ship' ? controls('ship') : S.opp === 'remote' ? theirKeys() : aiShip();
  step({ sub: subCtl, ship: shipCtl });
  if (S.record && (S.phase === 'play' ? n % 2 === 0 : n % 15 === 0)) sendPresence({ s: encode() });
  if (before === 'play' && S.phase === 'over') finish();
}

// fixed 60 Hz step, so high-refresh screens don't run the game double speed
export function startLoop() {
  loadHi();
  const STEP = 1000 / 60;
  let last = performance.now();
  let acc = 0;
  const frame = (now) => {
    acc += Math.min(250, now - last);
    last = now;
    while (acc >= STEP) { tick(); acc -= STEP; }
    draw();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// ---------- reacting to the lobby
createRoot(() => {
  // two pages pointing `inv` at each other: matched, go pick sides
  createEffect(() => {
    const o = opponent();
    if (o && screen() === 'lobby') untrack(() => { flash('MATCHED WITH ' + o.nick); enterRoles(); });
  });
  // opponent left (or matched someone else) while picking sides
  createEffect(() => {
    if (screen() !== 'roles' || against() !== 'remote') return;
    if (!opponent()) untrack(() => { flash('YOUR OPPONENT LEFT'); goLobby(); });
  });
  // both picked different sides and locked in: start. A ready flag only counts while
  // that player is on the roles screen (or has just started), never left over from a past game.
  createEffect(() => {
    if (screen() !== 'roles' || against() !== 'remote') return;
    const o = opponent();
    if (!o || !mine.ready || !o.ready || !mine.role || !o.role || mine.role === o.role) return;
    if (o.st !== 'roles' && o.st !== 'play') return;
    untrack(() => startOnline(o));
  });
  // my challenge was declined, or the player I challenged left
  createEffect(() => {
    const d = declinedBy();
    if (d) untrack(() => { flash(d.nick + ' DECLINED'); setMine({ inv: null }); });
  });
  createEffect(() => {
    const id = mine.inv;
    if (id && net.status === 'online' && screen() === 'lobby' && peerGone(id)) untrack(() => setMine({ inv: null }));
  });
});
