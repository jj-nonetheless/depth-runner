// Game state and rules. Plain mutable objects, stepped 60 times a second; the UI reads
// `S.phase` and the canvas renderer reads the rest.
import { W, SURF, BED, P, PU, SHIP_TABLE, CAP } from './constants.js';
import { beep, jingle, levelJingle, winJingle } from './sound.js';
import { vfx, shake, flash, clearVfx } from './vfx.js';

export const S = {
  mode: 1, // 1 = sub vs computer ships; 2 = sub vs destroyer
  myRole: 'sub',
  opp: 'cpu', // 2 players: 'cpu' or 'remote'
  phase: 'idle', // idle | play | over
  paused: false,
  winner: '',
  hi: 0,
  gid: 0,
  record: false, // online host: keep a log of effects so the other screen can replay them
  evs: [],
  evId: 0,
};

export function loadHi() {
  try { S.hi = +localStorage.getItem('depthrunner.hi') || 0; } catch { S.hi = 0; }
}
function saveHi() {
  try { localStorage.setItem('depthrunner.hi', S.hi); } catch { /* storage blocked */ }
}

export function newGame({ mode, myRole = 'sub', opp = 'cpu' }) {
  clearVfx();
  Object.assign(S, {
    mode, myRole, opp, phase: 'play', paused: false, winner: '', gid: Date.now() % 1e9,
    sub: { x: 74, y: BED - 6, shield: false, twin: 0, rapid: 0 },
    ships: [], charges: [], torps: [], parts: [], items: [], evs: [],
    score: 0, lives: 3, level: 1, sunk: 0, cool: 0, inv: 60, spawn: 30,
    boatLives: 3,
    boat: { x: 72, y: SURF - 5, vx: 0, cool: 30, down: 0, inv: 60, armor: false, cluster: 0, rapid: 0 },
    elapsed: 0, puSub: 600 + Math.random() * 300, puShip: 600 + Math.random() * 300,
    msg: { text: '', c: '', t: 0 },
  });
}

// ---------- effects: sound + particles, optionally recorded for the online guest
export function boom(x, y, n, c) {
  for (let i = 0; i < n; i++) {
    S.parts.push({ x, y, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, l: 20 + Math.random() * 20, c });
  }
}
export const FX = {
  fire: (x, y) => { beep(880, 0.08); vfx('muzzle', x, y); },
  twin: (x, y) => { beep(990, 0.08); vfx('muzzle', x - 3, y); vfx('muzzle', x + 5, y); },
  drop: (x, y) => { beep(200, 0.1, 'triangle'); vfx('splash', x, SURF, { small: true }); },
  chg: (x, y) => { boom(x, y, 8, P.boom); beep(300, 0.15, 'sawtooth'); vfx('boom', x, y, { size: 1 }); vfx('ring', x, y, { r: 10 }); shake(1.5); },
  sink: (x, y) => { boom(x, y, 30, P.boom); boom(x, y, 15, P.red); beep(90, 0.4, 'sawtooth', 0.08); bigBlast(x, y, 'ship'); },
  bsink: (x, y) => { boom(x, y, 30, P.boom); boom(x, y, 15, P.boat); beep(90, 0.4, 'sawtooth', 0.08); bigBlast(x, y, 'boat'); },
  guard: (x, y) => { boom(x, y, 14, P.def); beep(500, 0.15, 'triangle'); vfx('guard', x, y); vfx('ring', x, y, { r: 14, color: 'def' }); },
  subhit: (x, y) => { boom(x, y, 40, P.sub); beep(60, 0.6, 'sawtooth', 0.1); vfx('boom', x, y, { size: 3 }); vfx('ring', x, y, { r: 26 }); shake(7); flash('#fff4d0', 10); },
  bed: (x, y) => { boom(x, y, 6, P.bed); beep(120, 0.1, 'triangle'); vfx('sand', x, y); vfx('boom', x, y - 1, { size: 1 }); },
  pu: (x, y) => { jingle(); vfx('sparkle', x, y); },
  lvl: () => { levelJingle(); flash('#c8e0ff', 6); },
  win: () => winJingle(),
};
function bigBlast(x, y, sprite) {
  vfx('boom', x, y, { size: 3 });
  vfx('boom', x - 5, y + 2, { size: 2, delay: 6 });
  vfx('boom', x + 6, y - 1, { size: 2, delay: 11 });
  vfx('splash', x, SURF);
  vfx('wreck', x, y, { sprite });
  shake(5);
  flash('#ffe8a0', 6);
}
export function fx(type, x = 0, y = 0) {
  FX[type](x, y);
  if (S.record) {
    S.evs.push([++S.evId, type, Math.round(x), Math.round(y)]);
    if (S.evs.length > 12) S.evs.shift();
  }
}

export function stepParts() {
  for (const p of S.parts) { p.x += p.vx; p.y += p.vy; p.l--; }
  S.parts = S.parts.filter((p) => p.l > 0);
}
export function setMsg(text, c, t = 120, k, o) { S.msg = { text, c, t, k, o }; }

const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function endGame(w) {
  S.phase = 'over';
  S.winner = w;
  if (S.mode === 1 && S.score > S.hi) { S.hi = S.score; saveHi(); }
  if (S.mode === 2) fx('win');
}

// ---------- power-ups
// gaps between power-ups shrink from ~9-18s toward ~5-14s over the first two minutes
const puGap = () => 540 + Math.random() * 540 - Math.min(240, S.elapsed / 30);
function pick(table) {
  let total = 0;
  for (const e of table) total += e[1];
  let r = Math.random() * total;
  for (const e of table) if ((r -= e[1]) < 0) return e[0];
  return table[0][0];
}
function subTable() {
  const t = [['shield', 35], ['twin', 30], ['rapid', 30]];
  if (S.mode === 1 && S.level >= 2 && S.lives < 5) t.push(['life', 8]);
  return t;
}
export function spawnItem(owner, kind, x) {
  if (owner === 'sub') S.items.push({ owner, kind, x: x ?? 4 + Math.random() * (W - 8 - CAP), y: SURF + 2, v: 0.4, life: 300 });
  else S.items.push({ owner, kind, x: x ?? 8 + Math.random() * (W - 16 - CAP), y: SURF - 8, v: 0, life: 360 });
}
export function applySub(k, x = S.sub.x + 6, y = S.sub.y) {
  const p = PU[k];
  if (k === 'shield') S.sub.shield = true;
  else if (k === 'life') S.lives++;
  else S.sub[k] = p.dur;
  setMsg(p.name, p.c, 90, k, 'sub');
  fx('pu', x, y);
}
export function applyShip(k, x = S.boat.x + 8, y = S.boat.y) {
  const p = PU[k];
  if (k === 'armor') S.boat.armor = true;
  else if (k === 'cluster') S.boat.cluster = p.dur;
  else S.boat.rapid = p.dur;
  setMsg('SHIP ' + p.name, p.c, 90, k, 'ship');
  fx('pu', x, y);
}
function updateItems() {
  S.elapsed++;
  if (--S.puSub <= 0) { spawnItem('sub', pick(subTable())); S.puSub = puGap(); }
  if (S.mode === 2 && --S.puShip <= 0) { spawnItem('ship', pick(SHIP_TABLE)); S.puShip = puGap(); }
  const subBox = { x: S.sub.x, y: S.sub.y, w: 12, h: 5 };
  for (const it of S.items) {
    const box = { x: it.x, y: it.y, w: CAP, h: CAP };
    if (it.owner === 'sub') {
      if (it.y < BED - CAP) it.y = Math.min(BED - CAP, it.y + it.v); else it.life--;
      if (hit(subBox, box)) { it.dead = true; applySub(it.kind, it.x + CAP / 2, it.y + CAP / 2); }
    } else {
      it.life--;
      if (S.boat.down === 0 && hit({ x: S.boat.x, y: S.boat.y, w: 16, h: 6 }, box)) { it.dead = true; applyShip(it.kind, it.x + CAP / 2, it.y + CAP / 2); }
    }
    if (it.life <= 0) it.dead = true;
  }
  S.items = S.items.filter((i) => !i.dead);
  const { sub, boat } = S;
  if (sub.twin > 0) sub.twin--;
  if (sub.rapid > 0) sub.rapid--;
  if (boat.cluster > 0) boat.cluster--;
  if (boat.rapid > 0) boat.rapid--;
}

// ---------- the two sides
function updateSub(c) {
  const { sub } = S;
  if (c.l) sub.x -= 1.2;
  if (c.r) sub.x += 1.2;
  sub.x = Math.max(0, Math.min(W - 12, sub.x));
  if (S.cool > 0) S.cool--;
  const twin = sub.twin > 0;
  if (c.a && S.cool === 0 && S.torps.length + (twin ? 2 : 1) <= (twin ? 6 : 3)) {
    if (twin) S.torps.push({ x: sub.x + 1, y: sub.y - 1 }, { x: sub.x + 9, y: sub.y - 1 });
    else S.torps.push({ x: sub.x + 4, y: sub.y - 2 });
    S.cool = sub.rapid > 0 ? 6 : 15;
    fx(twin ? 'twin' : 'fire', sub.x + 5, sub.y - 1);
  }
  if (S.inv > 0) S.inv--;
}
function updateAiShips() {
  if (--S.spawn <= 0) {
    const fromLeft = Math.random() < 0.5;
    S.ships.push({ x: fromLeft ? -16 : W, y: SURF - 5, v: (fromLeft ? 1 : -1) * (0.3 + Math.random() * 0.3 + S.level * 0.08) });
    S.spawn = Math.max(40, 120 - S.level * 10) + Math.random() * 60;
  }
  for (const s of S.ships) {
    s.x += s.v;
    if (s.x > 4 && s.x < W - 20 && Math.random() < 0.006 + S.level * 0.002) {
      S.charges.push({ x: s.x + 7, y: SURF + 1, v: 0.35 + S.level * 0.05 + Math.random() * 0.2 });
      fx('drop', s.x + 7, SURF);
    }
  }
  S.ships = S.ships.filter((s) => s.x > -20 && s.x < W + 20);
}
function updateBoat(c) {
  const { boat } = S;
  if (boat.down > 0) {
    if (--boat.down === 0) { boat.x = Math.random() < 0.5 ? 0 : W - 16; boat.inv = 90; }
    boat.vx = 0;
    return;
  }
  const px = boat.x;
  if (c.l) boat.x -= 1;
  if (c.r) boat.x += 1;
  boat.x = Math.max(0, Math.min(W - 16, boat.x));
  boat.vx = boat.x - px;
  if (boat.cool > 0) boat.cool--;
  if (boat.inv > 0) boat.inv--;
  const cluster = boat.cluster > 0;
  if (c.a && boat.cool === 0 && S.charges.length < (cluster ? 8 : 5)) {
    for (const x of cluster ? [boat.x + 1, boat.x + 7, boat.x + 13] : [boat.x + 7]) S.charges.push({ x, y: SURF + 1, v: 0.65 });
    boat.cool = boat.rapid > 0 ? 18 : 40;
    fx('drop', boat.x + 7, SURF);
  }
}

// ---------- collisions
function sinkBoat(t) {
  const { boat } = S;
  t.dead = true;
  if (boat.armor) { boat.armor = false; boat.inv = 30; fx('guard', boat.x + 8, boat.y + 3); return; }
  S.boatLives--;
  boat.cluster = 0;
  boat.rapid = 0;
  fx('bsink', boat.x + 8, boat.y + 3);
  if (S.boatLives <= 0) endGame('SUB'); else boat.down = 90;
}
function torpedoHits() {
  const { boat } = S;
  for (const t of S.torps) {
    const tb = { x: t.x, y: t.y, w: 2, h: 4 };
    for (const c of S.charges) {
      if (!c.dead && !t.dead && hit(tb, { x: c.x - 1, y: c.y - 1, w: 4, h: 4 })) { c.dead = t.dead = true; S.score += 10; fx('chg', c.x, c.y); }
    }
    for (const s of S.ships) {
      if (!s.dead && !t.dead && hit(tb, { x: s.x, y: s.y, w: 16, h: 6 })) {
        s.dead = t.dead = true;
        S.score += 100;
        S.sunk++;
        fx('sink', s.x + 8, s.y + 3);
        if (S.sunk % 8 === 0) { S.level++; fx('lvl'); }
      }
    }
    if (S.mode === 2 && S.phase === 'play' && boat.down === 0 && boat.inv === 0 && !t.dead && hit(tb, { x: boat.x, y: boat.y, w: 16, h: 6 })) sinkBoat(t);
  }
}
function hitSub(c) {
  const { sub } = S;
  c.dead = true;
  if (sub.shield) { sub.shield = false; S.inv = 30; fx('guard', sub.x + 6, sub.y + 2); return; }
  S.lives--;
  sub.twin = 0;
  sub.rapid = 0;
  fx('subhit', sub.x + 6, sub.y + 2);
  S.inv = 90;
  if (S.lives <= 0) endGame('SHIP');
}
function chargeHits() {
  const subBox = { x: S.sub.x, y: S.sub.y, w: 12, h: 5 };
  for (const c of S.charges) {
    if (c.dead) continue;
    if (S.inv === 0 && hit({ x: c.x - 1, y: c.y - 1, w: 4, h: 4 }, subBox)) hitSub(c);
    else if (c.y >= BED - 1) { c.dead = true; fx('bed', c.x, BED - 1); }
  }
}

/** One 1/60 s tick. `ctl.sub` / `ctl.ship` are {l, r, a} (left, right, action). */
export function step(ctl) {
  if (S.phase !== 'play' || S.paused) { stepParts(); return; }
  updateSub(ctl.sub);
  if (S.mode === 1) updateAiShips(); else updateBoat(ctl.ship);
  updateItems();
  for (const c of S.charges) c.y += c.v;
  for (const t of S.torps) t.y -= 2;
  torpedoHits();
  if (S.phase === 'play') chargeHits();
  S.charges = S.charges.filter((c) => !c.dead);
  S.torps = S.torps.filter((t) => !t.dead && t.y > SURF);
  S.ships = S.ships.filter((s) => !s.dead);
  if (S.msg.t > 0) S.msg.t--;
  stepParts();
}

/** The other player left: the computer plays their side from here on. */
export function cpuTakeover(text) {
  S.opp = 'cpu';
  S.record = false;
  S.cool = 0;
  for (const c of S.charges) if (!(c.v > 0)) c.v = 0.65;
  setMsg(text, P.red, 180);
}

