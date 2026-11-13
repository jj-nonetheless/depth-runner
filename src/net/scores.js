// Top 10 for 1 player games.
//
// Shared board: the artifact's `db`. Each player writes one document, scores/<their id>, holding
// their own ten best scores; everyone reads every document and the page merges them into one
// Top 10. Rules (declared at publish): scores readable by all, each player writes only their own,
// the owner can tidy up. Players with view-only access can read but not save.
// Device board: the same list kept in this browser, so scores are remembered anywhere.
import { createStore } from 'solid-js/store';
import { cleanNick } from './room.js';

const LOCAL_KEY = 'depthrunner.top10';
const N = (v, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo; };
const byScore = (a, b) => b.score - a.score || a.at - b.at;

function cleanEntry(e, fallbackName) {
  if (!e || typeof e !== 'object') return null;
  const score = N(e.s, 0, 9999990) | 0;
  if (score <= 0) return null;
  return { name: cleanNick(e.n) || fallbackName || 'PLAYER', score, level: N(e.lv, 1, 99) | 0, at: N(e.at, 0, 1e13) };
}
const toStored = (e) => ({ n: e.name, s: e.score, lv: e.level, at: e.at });

function loadLocal() {
  try {
    const list = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    return (Array.isArray(list) ? list : []).map((e) => cleanEntry(e)).filter(Boolean).sort(byScore).slice(0, 10);
  } catch { return []; }
}

export const [board, setBoard] = createStore({
  status: 'loading', // loading | online | offline
  note: '',
  canSave: null, // true | false | null (not told; try and let the store decide)
  shared: [], // merged Top 10 across players: {name, score, level, at, mine}
  local: loadLocal(),
});

let db = null;
let myId = null;
let myBest = []; // my own document's entries, as last read
let saving = false;

/** Record a finished game in this browser's Top 10. Returns its place (1-10) or 0. */
export function recordLocal(name, score, level) {
  if (score <= 0) return 0;
  const entry = { name: cleanNick(name) || 'PLAYER', score, level, at: Date.now() };
  const list = [...board.local, entry].sort(byScore).slice(0, 10);
  setBoard('local', list);
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list.map(toStored))); } catch { /* storage blocked */ }
  return list.indexOf(entry) + 1;
}

/** Where a score would land on a list (1-10), or 0 if it wouldn't make it. */
export function placeOn(list, score) {
  if (score <= 0) return 0;
  const i = list.findIndex((e) => score > e.score);
  if (i >= 0) return i + 1;
  return list.length < 10 ? list.length + 1 : 0;
}

export async function connectScores() {
  const c = window.claude;
  if (!c || typeof c.use !== 'function') {
    setBoard({ status: 'offline', note: 'The shared Top 10 works on claude.ai. Scores are kept on this device.' });
    return;
  }
  const [store, user] = await Promise.all([c.use('db'), c.use('user')]).catch(() => [null, null]);
  if (!store) {
    setBoard({ status: 'offline', note: 'The shared Top 10 isn’t available in this view (it needs you signed in to claude.ai). Scores are kept on this device.' });
    return;
  }
  db = store;
  myId = user ? await user.id().catch(() => null) : null;
  const can = user ? await user.can('data.write').catch(() => null) : null;
  setBoard('canSave', myId ? can : false);

  const slow = setTimeout(() => {
    if (board.status === 'loading') setBoard('note', 'Can’t reach the shared Top 10 yet.');
  }, 10000);
  db.collection('scores').onSnapshot((snap) => {
    const all = [];
    for (const d of snap.docs) {
      const data = d.data() || {};
      const owner = cleanNick(data.name);
      const entries = (Array.isArray(data.best) ? data.best.slice(0, 10) : []).map((e) => cleanEntry(e, owner)).filter(Boolean);
      if (d.id === myId) myBest = entries;
      for (const e of entries) all.push({ ...e, mine: d.id === myId });
    }
    if (!snap.metadata.fromCache) { clearTimeout(slow); setBoard('note', ''); }
    setBoard({ status: 'online', shared: all.sort(byScore).slice(0, 10) });
  }, (e) => {
    clearTimeout(slow);
    const code = /^[a-z_]{1,40}$/.test(e?.code) ? e.code : 'error';
    setBoard({ status: 'offline', note: `The shared Top 10 stopped (${code}). Scores are kept on this device.` });
  });
}

/** Save a score to the shared Top 10 under my own document. Resolves to an error message or ''. */
export async function saveShared(name, score, level) {
  if (!db || !myId) return 'You need to be signed in to claude.ai to save to the shared Top 10.';
  if (board.canSave === false) return 'Your access to this page is view-only, so you can’t save scores. Ask the owner for Contributor access.';
  if (saving) return 'Already saving.';
  saving = true;
  const nick = cleanNick(name) || 'PLAYER';
  const best = [...myBest, { name: nick, score, level, at: Date.now() }].sort(byScore).slice(0, 10);
  try {
    await db.doc('scores/' + myId).set({ name: nick, best: best.map(toStored) });
    myBest = best;
    return '';
  } catch (e) {
    if (e?.code === 'invalid_argument') { setBoard('canSave', false); return 'This page won’t let you save scores. Ask the owner for Contributor access.'; }
    if (e?.code === 'quota_exceeded') return 'The scoreboard is full. Ask the page owner to clear old scores.';
    return 'Couldn’t save just now. Try again in a moment.';
  } finally {
    saving = false;
  }
}
