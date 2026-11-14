// 16-bit look: draws the game at 320x240 (two screen pixels per game unit): the parallax scene, the sprites with
// their animations, the effects, and the HUD. Menus are Solid components laid over the canvas.
import { SURF, ICON, PU, CAP } from './constants.js';
import { S } from './engine.js';
import { V, stepVfx } from './vfx.js';
import { SPR, buildArt, disc, ring, K } from './art.js';
import { buildScene, stepScene, drawBack, drawFront, waveY, bubble, SW, SH, SURF_Y, BED_Y } from './scene.js';

const Z = 2;
let ctx;
let tick = 0;
// renderer-only state: facing, bubbles, smoke
const R = { subDir: 1, subPrev: null, subMoving: 0, boatDir: 1, boatPrev: null, bubbles: [], smoke: [] };

export function attach(canvas) {
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  buildArt();
  buildScene();
  if (document.fonts?.load) document.fonts.load('8px "Press Start 2P"').catch(() => {});
}

const live = () => !!S.sub && (S.phase === 'play' || S.phase === 'over');
// a cheap repeatable "random" per index, for effects that must look the same every frame
const hash = (n) => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };

function addBubble(x, y, r = 1, vy = 0.5, life = 90 + hash(x + y) * 60) {
  if (y <= SURF_Y + 2) return;
  R.bubbles.push({ x, y, r, vy, life, ph: hash(y) * 6 });
  if (R.bubbles.length > 240) R.bubbles.shift();
}

/** Advance animations one 1/60 s tick (called by the game loop whatever screen is showing). */
export function animate() {
  tick++;
  const on = live();
  stepScene(on ? S.sub.x : undefined);
  for (const e of V.list) {
    const start = (e.delay || 0) + 1;
    if (e.t === start && e.y > SURF + 1) {
      const n = e.kind === 'boom' ? 4 + e.size * 4 : e.kind === 'muzzle' ? 3 : 0;
      for (let i = 0; i < n; i++) addBubble(e.x * Z + (hash(i + e.x) - 0.5) * 16, e.y * Z + (hash(i * 3 + e.y) - 0.5) * 12, 1 + hash(i) * 2, 0.6 + hash(i * 7) * 0.6);
    }
    if (e.kind === 'wreck' && e.t % 5 === 0) addBubble(e.x * Z + (hash(e.t) - 0.5) * 20, wreckY(e) - 4, 1 + hash(e.t * 3), 0.7);
  }
  stepVfx();
  if (on) {
    const { sub, boat } = S;
    if (R.subPrev !== null && Math.abs(sub.x - R.subPrev) > 0.05) { R.subDir = sub.x > R.subPrev ? 1 : -1; R.subMoving = 10; }
    R.subPrev = sub.x;
    if (R.subMoving > 0) R.subMoving--;
    if (R.boatPrev !== null && Math.abs(boat.x - R.boatPrev) > 0.05) R.boatDir = boat.x > R.boatPrev ? 1 : -1;
    R.boatPrev = boat.x;
    // propeller wash, torpedo trails, sinking charges
    if (tick % (R.subMoving ? 4 : 16) === 0) addBubble(sub.x * Z + (R.subDir > 0 ? -3 : 27), sub.y * Z + 4, 1 + (tick % 3 === 0), 0.5, 70);
    for (const t of S.torps) if (tick % 3 === 0) addBubble(t.x * Z + 1 + hash(tick) * 2, t.y * Z + 16, 1, 0.15, 22);
    for (const c of S.charges) if (tick % 12 === 0) addBubble(c.x * Z, c.y * Z - 4, 1, 0.4, 40);
    // funnel smoke
    if (tick % 8 === 0) {
      for (const s of S.ships) R.smoke.push({ x: s.x * Z + (s.v > 0 ? 10 : 21), y: s.y * Z - 2 + waveY(s.x * Z + 16), t: 0 });
      if (S.mode === 2 && boat.down === 0 && tick % 16 === 0) R.smoke.push({ x: boat.x * Z + (R.boatDir > 0 ? 16 : 15), y: boat.y * Z - 1 + waveY(boat.x * Z + 16), t: 0, thin: true });
    }
  } else {
    R.subPrev = null;
    R.boatPrev = null;
  }
  for (const b of R.bubbles) { b.y -= b.vy; b.x += Math.sin(tick * 0.08 + b.ph) * 0.25; b.life--; }
  R.bubbles = R.bubbles.filter((b) => b.life > 0 && b.y > SURF_Y + 1);
  for (const p of R.smoke) { p.t++; p.y -= 0.35; p.x -= 0.2; }
  R.smoke = R.smoke.filter((p) => p.t < 50);
  if (R.smoke.length > 60) R.smoke.splice(0, R.smoke.length - 60);
}

// ---------- sprites
function drawSub() {
  const { sub } = S;
  if (!(S.inv === 0 || (S.inv >> 2) % 2 || !live())) return;
  if (S.phase === 'over' && S.lives <= 0) return;
  const bob = Math.round(Math.sin(tick * 0.06) * 1);
  const x = Math.round(sub.x * Z) - 3, y = Math.round(sub.y * Z) - 7 + bob;
  const right = R.subDir > 0;
  ctx.drawImage(right ? SPR.sub.r : SPR.sub.l, x, y);
  const frame = (tick >> (R.subMoving ? 1 : 3)) % 2;
  ctx.drawImage(right ? SPR.prop[frame].r : SPR.prop[frame].l, right ? x - 2 : x + 30, y + 9);
  if (sub.shield && S.phase === 'play') {
    const cx = x + 15, cy = y + 10;
    ctx.globalAlpha = 0.18 + 0.08 * Math.sin(tick * 0.2);
    ctx.drawImage(disc(17, '#6CD2E6'), cx - 17, cy - 17);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(ring(17, (tick >> 3) % 2 ? '#6CD2E6' : '#e8fbff'), cx - 17, cy - 17);
    ctx.globalAlpha = 1;
  }
}

function wake(cx, dir, speed) {
  const n = Math.round(6 + speed * 14);
  for (let i = 0; i < n; i++) {
    const x = cx - dir * (i * 2 + 4);
    if ((i + (tick >> 2)) % 3 === 0) continue;
    ctx.fillStyle = i < 3 ? '#ffffff' : '#d8f0ff';
    ctx.fillRect(Math.round(x), Math.round(SURF_Y + waveY(x)) - 1, 2, 1);
  }
}

function drawShips() {
  for (const s of S.ships) {
    const cx = s.x * Z + 16;
    const x = Math.round(s.x * Z), y = Math.round(s.y * Z - 3 + waveY(cx));
    wake(s.v > 0 ? x : x + 32, s.v > 0 ? 1 : -1, Math.abs(s.v));
    ctx.drawImage(s.v > 0 ? SPR.ship.r : SPR.ship.l, x, y);
  }
  const { boat } = S;
  if (S.mode !== 2 || boat.down > 0 || (S.phase === 'over' && S.winner === 'SUB')) return;
  if (!(boat.inv === 0 || (boat.inv >> 2) % 2)) return;
  const cx = boat.x * Z + 16;
  const x = Math.round(boat.x * Z), y = Math.round(boat.y * Z - 3 + waveY(cx));
  if (Math.abs(boat.x - (R.boatPrevDraw ?? boat.x)) > 0.05) wake(R.boatDir > 0 ? x : x + 32, R.boatDir, 0.6);
  R.boatPrevDraw = boat.x;
  ctx.drawImage(R.boatDir > 0 ? SPR.boat.r : SPR.boat.l, x, y);
  // radar light blinks
  if ((tick >> 4) % 2) { ctx.fillStyle = '#ff5a4a'; ctx.fillRect(x + 16, y, 1, 1); }
  if (boat.armor) {
    ctx.globalAlpha = 0.85;
    ctx.drawImage(ring(20, (tick >> 3) % 2 ? '#6CD2E6' : '#e8fbff'), x - 4, y - 13);
    ctx.globalAlpha = 1;
  }
}

function drawSmoke() {
  for (const p of R.smoke) {
    const r = (p.thin ? 1.5 : 2) + p.t * 0.08;
    ctx.globalAlpha = Math.max(0, 0.6 - p.t / 80);
    ctx.drawImage(disc(r, p.t < 10 ? '#5a5466' : '#8a8498'), Math.round(p.x - r), Math.round(p.y - r));
  }
  ctx.globalAlpha = 1;
}

function drawCharges() {
  for (const c of S.charges) {
    ctx.save();
    ctx.translate(Math.round(c.x * Z), Math.round(c.y * Z));
    // tumbles as it sinks, in 45-degree steps like hardware sprite rotation
    ctx.rotate((Math.round((tick * 0.08 + c.x) / (Math.PI / 4)) * Math.PI) / 4);
    ctx.drawImage(SPR.charge, -4, -4);
    ctx.restore();
  }
}

function drawTorps() {
  for (const t of S.torps) {
    const x = Math.round(t.x * Z), y = Math.round(t.y * Z) - 2;
    ctx.drawImage(SPR.torp, x, y);
    ctx.fillStyle = (tick >> 1) % 2 ? '#ffffff' : '#9ad0ff';
    ctx.fillRect(x + 1, y + 10, 2, 1 + ((tick >> 1) % 2));
  }
}

function capsule(it) {
  const p = PU[it.kind];
  const ship = it.owner === 'ship';
  const cx = it.x * Z;
  const bob = ship ? Math.round(waveY(cx + 9)) : Math.round(Math.sin(tick * 0.1 + it.x) * 1);
  const x = Math.round(it.x * Z), y = Math.round(it.y * Z) + bob, s = CAP * Z;
  if (ship) {
    // a little striped float under the capsule
    ctx.fillStyle = K; ctx.fillRect(x + 3, y + s - 2, 12, 6);
    ctx.fillStyle = '#e84a3a'; ctx.fillRect(x + 4, y + s - 1, 10, 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 8, y + s - 1, 2, 4);
  }
  // outline, body, bevel
  ctx.fillStyle = (tick >> 4) % 2 ? '#ffffff' : K;
  ctx.fillRect(x + 2, y, s - 4, s); ctx.fillRect(x, y + 2, s, s - 4); ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  ctx.fillStyle = p.c; ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x + 2, y + 2, s - 6, 2); ctx.fillRect(x + 2, y + 2, 2, s - 6);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 4, y + s - 4, s - 6, 2); ctx.fillRect(x + s - 4, y + 4, 2, s - 6);
  const icon = ICON[it.kind];
  ctx.fillStyle = '#14102E';
  for (let r = 0; r < 7; r++) for (let i = 0; i < 7; i++) if (icon[r][i] === '#') ctx.fillRect(x + 2 + i * 2, y + 2 + r * 2, 2, 2);
}
function drawItems() {
  for (const it of S.items) {
    if (it.life < 90 && (tick >> 2) % 2) continue;
    capsule(it);
  }
}

function drawBubbles() {
  for (const b of R.bubbles) {
    ctx.globalAlpha = Math.min(1, b.life / 20);
    if (b.r < 1.5) { ctx.fillStyle = '#cfefff'; ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 1); }
    else ctx.drawImage(bubble(b.r), Math.round(b.x), Math.round(b.y));
  }
  ctx.globalAlpha = 1;
}
function drawParts() {
  for (const p of S.parts) {
    ctx.globalAlpha = Math.min(1, p.l / 25);
    ctx.fillStyle = p.c;
    ctx.fillRect(Math.round(p.x * Z), Math.round(p.y * Z), 2, 2);
  }
  ctx.globalAlpha = 1;
}

// ---------- effects
function wreckY(e) {
  const p = Math.min(1, e.t / (e.life * 0.85));
  return e.y * Z + Math.pow(p, 1.5) * (BED_Y - 8 - e.y * Z);
}
const BOOM_R = [0, 8, 13, 20];
function drawVfx(wrecks) {
  for (const e of V.list) {
    if ((e.kind === 'wreck') !== wrecks) continue;
    const t = e.t - (e.delay || 0);
    if (t < 0) continue;
    const p = t / (e.life - (e.delay || 0));
    const x = e.x * Z, y = e.y * Z;
    if (e.kind === 'wreck') {
      if (e.dir === undefined) e.dir = e.sprite === 'boat' ? R.boatDir : hash(e.x) < 0.5 ? 1 : -1;
      const img = e.dir > 0 ? SPR[e.sprite].r : SPR[e.sprite].l;
      ctx.save();
      ctx.globalAlpha = p > 0.8 ? (1 - p) * 5 : 1;
      ctx.translate(Math.round(x), Math.round(wreckY(e)));
      ctx.rotate(Math.round((e.dir * Math.min(0.7, p * 1.6)) / 0.1) * 0.1);
      ctx.drawImage(img, -16, -7);
      if (p < 0.35) {
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = ['#fff2a0', '#ffb43a', '#ff6a2a'][(i + (tick >> 1)) % 3];
          ctx.fillRect(-10 + i * 4, -9 - ((tick + i * 3) % 5), 2, 2);
        }
      }
      ctx.restore();
    } else if (e.kind === 'boom') {
      const r = BOOM_R[e.size] || 8;
      const grow = Math.sin(Math.min(1, p * 2.2) * (Math.PI / 2));
      // smoke above water, a pale cloud of churned water below
      const wet = y > SURF_Y + 4;
      ctx.globalAlpha = Math.max(0, (wet ? 0.45 : 0.7) - p * (wet ? 0.45 : 0.7));
      const sm = r * (0.7 + p * 0.9);
      ctx.drawImage(disc(sm, wet ? '#9cc4ec' : p > 0.4 ? '#4a4460' : '#6a3a3a'), Math.round(x - sm), Math.round(y - sm - p * 6));
      ctx.globalAlpha = 1;
      if (p < 0.75) {
        const o = r * grow * (1 - p * 0.5), m = o * 0.7, c = o * 0.4 * (1 - p * 1.2);
        ctx.drawImage(disc(o, '#ff6a2a'), Math.round(x - o), Math.round(y - o));
        ctx.drawImage(disc(m, '#ffb43a'), Math.round(x - m), Math.round(y - m));
        if (c > 1) ctx.drawImage(disc(c, '#fff6c8'), Math.round(x - c), Math.round(y - c));
      }
    } else if (e.kind === 'ring') {
      const r = (e.r || 10) * Z * (0.3 + p * 0.9);
      ctx.globalAlpha = 1 - p;
      ctx.drawImage(ring(r, e.color === 'def' ? '#9ae8ff' : '#d8f0ff'), Math.round(x - r), Math.round(y - r));
      ctx.globalAlpha = 1;
    } else if (e.kind === 'splash') {
      const n = e.small ? 6 : 14, power = e.small ? 1.6 : 3.2;
      for (let i = 0; i < n; i++) {
        const vx = (hash(i + e.x) - 0.5) * (e.small ? 1.2 : 2.4), v0 = power * (0.6 + hash(i * 5 + e.x) * 0.6);
        const py = SURF_Y - (v0 * t - 0.09 * t * t);
        if (py > SURF_Y + 2) continue;
        ctx.fillStyle = i % 3 ? '#e8f6ff' : '#9ad0ff';
        ctx.fillRect(Math.round(x + vx * t), Math.round(py), 2, 2);
      }
      ctx.fillStyle = `rgba(255,255,255,${(1 - p).toFixed(2)})`;
      const w = 4 + p * (e.small ? 14 : 30);
      ctx.fillRect(Math.round(x - w / 2), SURF_Y + Math.round(waveY(x)), Math.round(w), 1);
    } else if (e.kind === 'sand') {
      ctx.globalAlpha = 1 - p;
      for (let i = 0; i < 10; i++) {
        const a = Math.PI + (i / 9) * Math.PI, d = 3 + p * 14 * (0.6 + hash(i) * 0.6);
        ctx.fillStyle = i % 2 ? '#c8a26a' : '#9a7446';
        ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.6), 2, 2);
      }
      ctx.globalAlpha = 1;
    } else if (e.kind === 'sparkle') {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + p, d = 4 + p * 18;
        ctx.fillStyle = ['#ffffff', '#fff2a0', '#9ae8ff'][(i + (tick >> 2)) % 3];
        const sx = Math.round(x + Math.cos(a) * d), sy = Math.round(y + Math.sin(a) * d);
        ctx.fillRect(sx, sy - 1, 1, 3); ctx.fillRect(sx - 1, sy, 3, 1);
      }
    } else if (e.kind === 'muzzle') {
      const r = 4 * (1 - p);
      if (r > 1) ctx.drawImage(disc(r, '#ffffff'), Math.round(x - r), Math.round(y - r));
    } else if (e.kind === 'guard') {
      ctx.globalAlpha = 0.6 * (1 - p);
      ctx.drawImage(disc(16 + p * 6, '#9ae8ff'), Math.round(x - 16 - p * 6), Math.round(y - 16 - p * 6));
      ctx.globalAlpha = 1;
    }
  }
}

// ---------- HUD
function text(s, x, y, color = '#ffffff', align = 'left') {
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = K;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) ctx.fillText(s, x + dx, y + dy);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}
function lives(n, x, y, img, alignRight) {
  const shown = Math.min(n, 5);
  for (let i = 0; i < shown; i++) ctx.drawImage(img, alignRight ? x - (i + 1) * 12 : x + i * 12, y);
  if (n > 5) text('+' + (n - 5), alignRight ? x - shown * 12 - 4 : x + shown * 12 + 2, y - 1, '#ffffff', alignRight ? 'right' : 'left');
}
function puIcon(k, x, y, left, total) {
  if (left !== undefined && left < 120 && (tick >> 3) % 2) return;
  const icon = ICON[k];
  ctx.fillStyle = K;
  ctx.fillRect(x - 1, y - 1, 16, 16);
  ctx.fillStyle = PU[k].c;
  for (let r = 0; r < 7; r++) for (let i = 0; i < 7; i++) if (icon[r][i] === '#') ctx.fillRect(x + i * 2, y + r * 2, 2, 2);
  if (left !== undefined) {
    ctx.fillStyle = K; ctx.fillRect(x - 1, y + 15, 16, 3);
    ctx.fillStyle = PU[k].c; ctx.fillRect(x, y + 16, Math.round((14 * left) / total), 1);
  }
}
function drawHud() {
  const { sub, boat } = S;
  if (S.mode === 1) {
    text('SCORE', 6, 5, '#ffcf8a');
    text(String(S.score).padStart(6, '0'), 6, 15);
    text('LV ' + S.level, SW / 2, 5, '#ffffff', 'center');
    text('HI ' + String(S.hi).padStart(6, '0'), SW / 2, 15, '#ffcf8a', 'center');
    lives(S.lives, SW - 6, 6, SPR.life, true);
  } else {
    text('SUB', 6, 5, '#d4e86a');
    lives(S.lives, 6, 15, SPR.life, false);
    text('SHIP', SW - 6, 5, '#ffb0a0', 'right');
    lives(S.boatLives, SW - 6, 15, SPR.shipLife, true);
    text(S.opp === 'remote' ? 'ONLINE' : 'VS CPU', SW / 2, 5, '#ffffff', 'center');
    text('YOU: ' + S.myRole.toUpperCase(), SW / 2, 15, S.myRole === 'sub' ? '#d4e86a' : '#ffb0a0', 'center');
  }
  if (S.phase !== 'play') return;
  let x = 6;
  const subPu = [['shield', sub.shield ? 1 : 0], ['twin', sub.twin, 600], ['rapid', sub.rapid, 600]].filter((p) => p[1] > 0);
  if (subPu.length) {
    ctx.fillStyle = 'rgba(13,16,36,0.55)';
    ctx.fillRect(2, BED_Y - 2, subPu.length * 20 + 6, 22);
    for (const [k, left, total] of subPu) { puIcon(k, x, BED_Y + 1, total ? left : undefined, total); x += 20; }
  }
  if (S.mode === 2) {
    x = SW - 20;
    for (const [k, left, total] of [['armor', boat.armor ? 1 : 0], ['cluster', boat.cluster, 600], ['reload', boat.rapid, 600]]) {
      if (left > 0) { puIcon(k, x, 27, total ? left : undefined, total); x -= 20; }
    }
  }
  if (S.msg.t > 0) text(S.msg.text, SW / 2, 66, S.msg.c, 'center');
  if (S.paused) {
    ctx.fillStyle = 'rgba(13,16,36,0.7)';
    ctx.fillRect(SW / 2 - 60, 104, 120, 30);
    text('PAUSED', SW / 2, 115, '#ffffff', 'center');
  }
}

export function draw() {
  ctx.fillStyle = '#081736';
  ctx.fillRect(0, 0, SW, SH);
  ctx.save();
  if (V.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * V.shake * 2), Math.round((Math.random() - 0.5) * V.shake * 2));
  drawBack(ctx);
  if (live()) {
    drawItems();
    drawSmoke();
    drawShips();
    drawVfx(true); // sinking wrecks, behind the sub
    drawCharges();
    drawTorps();
    drawSub();
    drawBubbles();
    drawParts();
    drawVfx(false);
  } else {
    drawBubbles();
  }
  drawFront(ctx);
  ctx.restore();
  if (V.flash > 0) {
    ctx.globalAlpha = V.flash / 20;
    ctx.fillStyle = V.flashColor;
    ctx.fillRect(0, 0, SW, SH);
    ctx.globalAlpha = 1;
  }
  if (live()) drawHud();
}
