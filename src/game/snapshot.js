// What the online host (the sub player's page) shares about the game, and how the
// other page copies it in. Everything arriving here came from another viewer's page:
// numbers are clamped, kinds are checked against known lists, and no text is shown from it.
import { W, H, PU, CAP } from './constants.js';
import { S, FX } from './engine.js';

const r1 = (v) => Math.round(v * 10) / 10;

export function encode() {
  const { sub, boat, msg } = S;
  return {
    gid: S.gid, st: S.phase, w: S.winner,
    sx: r1(sub.x), sl: S.lives, hu: Math.round(S.hull), bh: Math.round(boat.hull), sh: sub.shield ? 1 : 0, tw: sub.twin, rp: sub.rapid, iv: S.inv,
    bx: r1(boat.x), bd: boat.down, bi: boat.inv, bl: S.boatLives, ba: boat.armor ? 1 : 0, bc: boat.cluster, br: boat.rapid,
    c: S.charges.map((c) => [r1(c.x), r1(c.y)]),
    tp: S.torps.map((t) => [r1(t.x), r1(t.y)]),
    it: S.items.map((i) => [i.owner === 'sub' ? 0 : 1, i.kind, r1(i.x), r1(i.y), i.life]),
    m: msg.t > 0 && msg.k ? [msg.k, msg.o, msg.t] : null,
    ev: S.evs,
  };
}

const N = (v, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo; };
const list = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
const has = (o, k) => typeof k === 'string' && Object.hasOwn(o, k);

/**
 * Copy a host snapshot into S. `guest` holds what this page has seen so far:
 * { gid, lastEv }. Returns 'over' when this snapshot ends the game being shown.
 */
export function apply(s, guest) {
  if (!s || typeof s !== 'object') return null;
  const gid = N(s.gid, 0, 1e12);
  if (gid !== guest.gid) {
    // a different game: only a game that is starting replaces the one on screen
    if (s.st !== 'play') return null;
    guest.gid = gid;
  }
  const { sub, boat } = S;
  sub.x = N(s.sx, 0, W - 12); S.lives = N(s.sl, 0, 9) | 0; sub.shield = !!s.sh; sub.twin = N(s.tw, 0, 999); sub.rapid = N(s.rp, 0, 999); S.inv = N(s.iv, 0, 999) | 0;
  boat.x = N(s.bx, 0, W - 16); boat.down = N(s.bd, 0, 999) | 0; boat.inv = N(s.bi, 0, 999) | 0; S.boatLives = N(s.bl, 0, 9) | 0;
  boat.armor = !!s.ba; boat.cluster = N(s.bc, 0, 999); boat.rapid = N(s.br, 0, 999);
  S.hull = N(s.hu, 0, 100); boat.hull = N(s.bh, 0, 100);
  S.charges = list(s.c, 16).map((a) => ({ x: N(a?.[0], -4, W + 4), y: N(a?.[1], 0, H), v: 0.65 }));
  S.torps = list(s.tp, 8).map((a) => ({ x: N(a?.[0], 0, W), y: N(a?.[1], 0, H) }));
  S.items = list(s.it, 8).filter((a) => Array.isArray(a) && has(PU, a[1]))
    .map((a) => ({ owner: a[0] ? 'ship' : 'sub', kind: a[1], x: N(a[2], 0, W - CAP), y: N(a[3], 0, H - CAP), life: N(a[4], 0, 999) }));
  if (Array.isArray(s.m) && has(PU, s.m[0])) {
    const o = s.m[1] === 'ship' ? 'ship' : 'sub';
    S.msg = { text: (o === 'ship' ? 'SHIP ' : '') + PU[s.m[0]].name, c: PU[s.m[0]].c, t: N(s.m[2], 0, 90), k: s.m[0], o };
  }
  for (const e of list(s.ev, 16)) {
    const id = N(e?.[0], 0, 1e12);
    if (id > guest.lastEv) {
      guest.lastEv = id;
      if (has(FX, e[1]) && e[1] !== 'win') FX[e[1]](N(e[2], 0, W), N(e[3], 0, H));
    }
  }
  if (s.st === 'over' && S.phase === 'play') {
    S.phase = 'over';
    S.winner = s.w === 'SUB' ? 'SUB' : 'SHIP';
    FX.win();
    return 'over';
  }
  return null;
}
