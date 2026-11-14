// Game state and rules. Plain mutable objects, stepped 60 times a second; the UI reads
// `S.phase` and the canvas renderer reads the rest.
import { W, SURF, BED, P, PU, SHIP_TABLE, CAP } from './constants.js';
import { beep, jingle, levelJingle, winJingle } from './sound.js';
import { vfx, shake, flash, clearVfx } from './vfx.js';
import { releaseAll } from './input.js';

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

// ---------- weapons (game units, ticks at 60 a second)
// Torpedoes and depth charges both explode with an area blast: damage is full at the centre and falls
// to nothing at the edge. Charges go off when they come close to the sub, hit the seabed, are shot, or
// are caught in another blast (a chain reaction). Torpedoes go off near a ship or at the surface.
// Reload times and in-water caps are set so neither side can simply out-shoot the other.
export const ARMS = {
  torpCool: 28, torpCoolRapid: 14, torpMax: 3, torpMaxTwin: 4,
  dropCool: 34, dropCoolReload: 18, chgMax: 4, chgMaxCluster: 6,
  shipDropGap: 90, // computer ships wait at least this long between charges
  chgR: 14, chgDmg: 70, chgFuse: 3,
  torpR: 12, torpDmg: 70, torpFuse: 4,
  chain: 5, // ticks before a charge caught in a blast goes off
  hull: 100, shipHull: 40,
};

export function loadHi() {
  try { S.hi = +localStorage.getItem('depthrunner.hi') || 0; } catch { S.hi = 0; }
}
function saveHi() {
  try { localStorage.setItem('depthrunner.hi', S.hi); } catch { /* storage blocked */ }
}

export function newGame({ mode, myRole = 'sub', opp = 'cpu' }) {
  clearVfx();
  releaseAll(); // nothing held over from the last game or the menus
  Object.assign(S, {
    mode, myRole, opp, phase: 'play', paused: false, winner: '', gid: Date.now() % 1e9,
    sub: { x: 74, y: BED - 6, shield: false, twin: 0, rapid: 0 },
    ships: [], charges: [], torps: [], parts: [], items: [], evs: [],
    score: 0, lives: 3, hull: ARMS.hull, level: 1, sunk: 0, cool: 0, inv: 60, spawn: 30,
    boatLives: 3,
    boat: { x: 72, y: SURF - 5, vx: 0, cool: 30, down: 0, inv: 60, armor: false, cluster: 0, rapid: 0, hull: ARMS.hull },
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
  chg: (x, y) => { boom(x, y, 12, P.boom); beep(260, 0.2, 'sawtooth'); vfx('boom', x, y, { size: 2 }); vfx('ring', x, y, { r: ARMS.chgR / 1.2 }); shake(2); if (y < SURF + 4) vfx('splash', x, SURF); },
  tbl: (x, y) => { boom(x, y, 10, P.boom); beep(330, 0.15, 'sawtooth'); vfx('boom', x, y, { size: 2 }); vfx('ring', x, y, { r: ARMS.torpR / 1.2 }); shake(1.5); if (y < SURF + 4) vfx('splash', x, SURF, { small: true }); },
  hurt: (x, y) => { boom(x, y, 10, P.red); beep(110, 0.25, 'sawtooth', 0.07); shake(3); flash('#ff6a4a', 4); },
  shurt: (x, y) => { boom(x, y, 8, P.red); beep(140, 0.2, 'sawtooth', 0.06); vfx('boom', x, y, { size: 1 }); },
  sink: (x, y) => { boom(x, y, 30, P.boom); boom(x, y, 15, P.red); beep(90, 0.4, 'sawtooth', 0.08); bigBlast(x, y, 'ship'); },
  bsink: (x, y) => { boom(x, y, 30, P.boom); boom(x, y, 15, P.boat); beep(90, 0.4, 'sawtooth', 0.08); bigBlast(x, y, 'boat'); },
  guard: (x, y) => { boom(x, y, 14, P.def); beep(500, 0.15, 'triangle'); vfx('guard', x, y); vfx('ring', x, y, { r: 14, color: 'def' }); },
  subhit: (x, y) => { boom(x, y, 40, P.sub); beep(60, 0.6, 'sawtooth', 0.1); vfx('boom', x, y, { size: 3 }); vfx('ring', x, y, { r: 26 }); shake(7); flash('#fff4d0', 10); },
  bed: (x, y) => { boom(x, y, 8, P.bed); beep(120, 0.2, 'triangle'); vfx('sand', x, y); vfx('boom', x, y - 1, { size: 2 }); vfx('ring', x, y, { r: ARMS.chgR / 1.2 }); shake(1.5); },
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
  if (c.a && S.cool === 0 && S.torps.length + (twin ? 2 : 1) <= (twin ? ARMS.torpMaxTwin : ARMS.torpMax)) {
    if (twin) S.torps.push({ x: sub.x + 1, y: sub.y - 1 }, { x: sub.x + 9, y: sub.y - 1 });
    else S.torps.push({ x: sub.x + 4, y: sub.y - 2 });
    S.cool = sub.rapid > 0 ? ARMS.torpCoolRapid : ARMS.torpCool;
    fx(twin ? 'twin' : 'fire', sub.x + 5, sub.y - 1);
  }
  if (S.inv > 0) S.inv--;
}
function updateAiShips() {
  if (--S.spawn <= 0) {
    const fromLeft = Math.random() < 0.5;
    S.ships.push({ x: fromLeft ? -16 : W, y: SURF - 5, v: (fromLeft ? 1 : -1) * (0.3 + Math.random() * 0.3 + S.level * 0.08), hp: ARMS.shipHull, cool: 20 + Math.random() * 40 });
    S.spawn = Math.max(40, 120 - S.level * 10) + Math.random() * 60;
  }
  for (const s of S.ships) {
    s.x += s.v;
    if (s.cool > 0) s.cool--;
    if (s.cool <= 0 && s.x > 4 && s.x < W - 20 && Math.random() < 0.012 + S.level * 0.003) {
      S.charges.push({ x: s.x + 7, y: SURF + 1, v: 0.35 + S.level * 0.05 + Math.random() * 0.2 });
      s.cool = ARMS.shipDropGap + Math.random() * 60;
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
  if (c.a && boat.cool === 0 && S.charges.length + (cluster ? 3 : 1) <= (cluster ? ARMS.chgMaxCluster : ARMS.chgMax)) {
    for (const x of cluster ? [boat.x + 1, boat.x + 7, boat.x + 13] : [boat.x + 7]) S.charges.push({ x, y: SURF + 1, v: 0.65 });
    boat.cool = boat.rapid > 0 ? ARMS.dropCoolReload : ARMS.dropCool;
    fx('drop', boat.x + 7, SURF);
  }
}

// ---------- blasts and damage
const distToBox = (x, y, b) => Math.hypot(Math.max(b.x - x, 0, x - (b.x + b.w)), Math.max(b.y - y, 0, y - (b.y + b.h)));
const subBox = () => ({ x: S.sub.x, y: S.sub.y, w: 12, h: 5 });
const shipBox = (s) => ({ x: s.x, y: s.y, w: 16, h: 6 });
const boatIn = () => S.mode === 2 && S.boat.down === 0;

function loseLife() {
  const { sub } = S;
  S.lives--;
  S.hull = ARMS.hull;
  sub.twin = 0;
  sub.rapid = 0;
  fx('subhit', sub.x + 6, sub.y + 2);
  S.inv = 90;
  if (S.lives <= 0) endGame('SHIP');
}
function damageSub(amount) {
  const { sub } = S;
  if (S.phase !== 'play' || S.inv > 0 || amount < 1) return;
  if (sub.shield) { sub.shield = false; S.inv = 30; fx('guard', sub.x + 6, sub.y + 2); return; }
  S.hull -= amount;
  if (S.hull <= 0) loseLife(); else fx('hurt', sub.x + 6, sub.y + 2);
}
function sinkBoat() {
  const { boat } = S;
  S.boatLives--;
  boat.hull = ARMS.hull;
  boat.cluster = 0;
  boat.rapid = 0;
  fx('bsink', boat.x + 8, boat.y + 3);
  if (S.boatLives <= 0) endGame('SUB'); else boat.down = 90;
}
function damageBoat(amount) {
  const { boat } = S;
  if (S.phase !== 'play' || boat.inv > 0 || amount < 1) return;
  if (boat.armor) { boat.armor = false; boat.inv = 30; fx('guard', boat.x + 8, boat.y + 3); return; }
  boat.hull -= amount;
  if (boat.hull <= 0) sinkBoat(); else fx('shurt', boat.x + 8, boat.y + 2);
}
function damageShip(s, amount) {
  if (s.dead || amount < 1) return;
  s.hp -= amount;
  if (s.hp > 0) { fx('shurt', s.x + 8, s.y + 2); return; }
  s.dead = true;
  S.score += 100;
  S.sunk++;
  fx('sink', s.x + 8, s.y + 3);
  if (S.sunk % 8 === 0) { S.level++; fx('lvl'); }
}

/** An explosion at (x, y): scaled damage to everything in range, and charges in range go off next. */
function blast(x, y, r, dmg, scoring) {
  for (const c of S.charges) {
    if (!c.dead && c.fuse === undefined && Math.hypot(c.x - x, c.y - y) < r) { c.fuse = ARMS.chain; c.scoring = scoring; }
  }
  for (const t of S.torps) if (!t.dead && Math.hypot(t.x + 1 - x, t.y + 2 - y) < r * 0.6) t.dead = true;
  const ds = distToBox(x, y, subBox());
  if (ds < r) damageSub(dmg * (1 - ds / r));
  for (const s of S.ships) { const d = distToBox(x, y, shipBox(s)); if (d < r) damageShip(s, dmg * (1 - d / r)); }
  if (boatIn()) { const d = distToBox(x, y, shipBox(S.boat)); if (d < r) damageBoat(dmg * (1 - d / r)); }
}
function detonateCharge(c) {
  c.dead = true;
  if (c.scoring) S.score += 10;
  fx(c.y >= BED - 2 ? 'bed' : 'chg', c.x, Math.min(c.y, BED - 1));
  blast(c.x, Math.min(c.y, BED - 1), ARMS.chgR, ARMS.chgDmg, c.scoring);
}
function detonateTorp(t) {
  t.dead = true;
  const y = Math.max(t.y, SURF);
  fx('tbl', t.x + 1, y);
  blast(t.x + 1, y, ARMS.torpR, ARMS.torpDmg, true);
}

function torpedoes() {
  const { boat } = S;
  for (const t of S.torps) {
    if (t.dead) continue;
    const tb = { x: t.x, y: t.y, w: 2, h: 4 };
    // shooting a depth charge sets it off
    const c = S.charges.find((k) => !k.dead && hit(tb, { x: k.x - 1, y: k.y - 1, w: 4, h: 4 }));
    if (c) { t.dead = true; c.scoring = true; detonateCharge(c); continue; }
    // proximity fuse near a ship, or the surface
    const near = S.ships.some((s) => !s.dead && distToBox(t.x + 1, t.y, shipBox(s)) < ARMS.torpFuse)
      || (boatIn() && boat.inv === 0 && distToBox(t.x + 1, t.y, shipBox(boat)) < ARMS.torpFuse);
    if (near || t.y <= SURF) detonateTorp(t);
  }
}
function charges() {
  const sb = subBox();
  for (const c of S.charges) {
    if (c.dead) continue;
    if (c.fuse !== undefined) { if (--c.fuse <= 0) detonateCharge(c); continue; }
    if (distToBox(c.x, c.y, sb) < ARMS.chgFuse || c.y >= BED - 1) detonateCharge(c);
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
  torpedoes();
  if (S.phase === 'play') charges();
  S.charges = S.charges.filter((c) => !c.dead);
  S.torps = S.torps.filter((t) => !t.dead && t.y > SURF - 2);
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

