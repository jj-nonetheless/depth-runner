// Online lobby over the claude.ai artifact `room` capability.
//
// Everything travels in presence: each open page publishes one small object about itself
// and receives everyone else's. Presence is the one part of the room every viewer may send
// (topic messages need edit access), so it works for anyone the platform lets in.
//
// My presence:  { dr: 2, nick, st, inv, at, no, role, ready, in, s }
//   st    where I am: title | solo | lobby | roles | play | over
//   inv   the peer I'm challenging or have accepted; two pages whose `inv` point at each other are a match
//   at    when I set `inv` (my clock), so a decline names one particular challenge
//   no    the challenge I declined, as '<peer>@<their at>'
//   role  'sub' | 'ship' once picked; ready = locked in
//   in    my keys during an online game (ship player)
//   s     game snapshot (sub player, who runs the game)
import { createStore, reconcile } from 'solid-js/store';

const STATES = ['title', 'solo', 'lobby', 'roles', 'play', 'over'];
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
export const cleanNick = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').trim().slice(0, 12);

function savedNick() {
  try { return cleanNick(localStorage.getItem('depthrunner.nick')); } catch { return ''; }
}
const firstNick = savedNick() || 'SAILOR ' + String(Math.floor(Math.random() * 90) + 10);

export const [net, setNet] = createStore({ status: 'connecting', reason: '', connected: false, me: '', peers: [] });
export const [mine, setMineStore] = createStore({ nick: firstNick, st: 'title', inv: null, at: 0, no: null, role: null, ready: false });

let room = null;
let raw = []; // latest platform peer list, read every tick by the game
const local = { dr: 2, nick: firstNick, st: 'title', inv: null, at: 0, no: null, role: null, ready: false, in: null, s: null };

export function sendPresence(patch) {
  Object.assign(local, patch);
  if (room) room.presence(patch).catch(() => {});
}
export function setMine(patch) {
  setMineStore(patch);
  sendPresence(patch);
}
export function setNick(n) {
  const nick = cleanNick(n) || firstNick;
  try { localStorage.setItem('depthrunner.nick', nick); } catch { /* storage blocked */ }
  setMine({ nick });
}

function view(p) {
  const pr = p.presence || {};
  return {
    peer: p.peer,
    sameBrowser: p.isMe && !p.sameTab,
    guest: !!p.guest,
    playing: pr.dr === 2,
    nick: cleanNick(pr.nick) || 'PLAYER ' + String(p.peer).slice(0, 4).toUpperCase(),
    st: oneOf(pr.st, STATES, 'title'),
    inv: typeof pr.inv === 'string' ? pr.inv : null,
    at: Number.isFinite(pr.at) ? pr.at : 0,
    no: typeof pr.no === 'string' ? pr.no : null,
    role: oneOf(pr.role, ['sub', 'ship'], null),
    ready: pr.ready === true,
  };
}

const OFFLINE_HERE = 'Online play only works on claude.ai, for people signed in with access to this page. You can still play the computer.';

export function connect() {
  const c = window.claude;
  if (!c || typeof c.use !== 'function') {
    setNet({ status: 'offline', reason: 'This copy is not running on claude.ai. ' + OFFLINE_HERE });
    return;
  }
  c.use('room').then((r) => {
    if (!r) { setNet({ status: 'offline', reason: 'This view can’t join the room. ' + OFFLINE_HERE }); return; }
    room = r;
    setNet({ status: 'online' });
    r.onPeers((ch) => {
      raw = ch.peers;
      const me = raw.find((p) => p.sameTab);
      if (me) setNet('me', me.peer);
      setNet('peers', reconcile(raw.filter((p) => !p.sameTab).map(view), { key: 'peer' }));
    }, (e) => {
      room = null;
      raw = [];
      const code = /^[a-z_]{1,40}$/.test(e?.code) ? e.code : 'error';
      setNet({ status: 'offline', reason: `The connection ended (${code}). ` + OFFLINE_HERE, peers: [] });
    });
    if (typeof r.onConnection === 'function') r.onConnection((ok) => setNet('connected', ok));
    r.presence({ ...local }).catch(() => {});
  }, () => setNet({ status: 'offline', reason: 'Could not connect. ' + OFFLINE_HERE }));
}

// ---------- lobby views (reactive: read inside components and effects)
export const others = () => net.peers;
/** The player I'm matched with: we each point `inv` at the other. */
export function opponent() {
  const id = mine.inv;
  if (!id || !net.me) return null;
  const p = net.peers.find((x) => x.peer === id);
  return p && p.inv === net.me ? p : null;
}
export const challengeId = (peer, at) => `${peer}@${at}`;
export const incoming = () => net.peers.filter((p) =>
  net.me && p.inv === net.me && p.peer !== mine.inv && mine.no !== challengeId(p.peer, p.at));
/** The player who turned down my current challenge, if they did. */
export function declinedBy() {
  const p = net.peers.find((x) => x.peer === mine.inv);
  return p && p.no === challengeId(net.me, mine.at) ? p : null;
}
export const peerGone = (id) => !net.peers.some((p) => p.peer === id);

// ---------- game traffic (read every tick, not reactive)
/** The matched opponent's live presence, or null if they left or matched someone else. */
export function opponentPresence() {
  const p = raw.find((x) => x.peer === local.inv);
  return p && p.presence && p.presence.inv === net.me ? p.presence : null;
}
