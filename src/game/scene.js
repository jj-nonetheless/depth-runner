// The world behind the game: a sunset sky, clouds and islands above the surface; light rays, three
// layers of rock and kelp, fish, bubbles and drifting specks below. Every layer scrolls at its own
// speed (parallax) with a slow current and with the sub's position, so the scene has depth even
// though the playfield itself never scrolls. Drawn at 320x240 screen pixels.
import { disc } from './art.js';

export const SW = 320;
export const SH = 240;
export const SURF_Y = 44;
export const BED_Y = 224;
const LW = 640; // background layers are 640 wide and tile seamlessly

export const SC = { t: 0, drift: 0, cam: 0, camTarget: 0 };

// small seeded random, so the scenery is the same every visit
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mod = (a, n) => ((a % n) + n) % n;
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
// a periodic height line (tiles across LW without a seam)
function ridge(rand, base, amp, waves) {
  const ph = Array.from({ length: waves }, () => rand() * Math.PI * 2);
  return (x) => base + ph.reduce((h, p, i) => h + Math.sin((x / LW) * Math.PI * 2 * (i + 1) * 2 + p) * (amp / (i + 1)), 0);
}

const L = {};
const SKY = ['#1b1440', '#271a56', '#3a2370', '#552c86', '#7a3a92', '#a64a92', '#d2618a', '#f0857e', '#ffab7c', '#ffcf8a'];
const SEA = ['#3b7fd0', '#2f6dbe', '#285fae', '#20509a', '#1a4386', '#153872', '#112e60', '#0d2550', '#0a1d42', '#081736'];

/** Banded gradient with a dithered row between bands (the 16-bit look instead of a smooth blend). */
function bands(x, colors, y0, h, w) {
  const bh = h / colors.length;
  colors.forEach((c, i) => {
    x.fillStyle = c;
    x.fillRect(0, Math.round(y0 + i * bh), w, Math.ceil(bh));
    if (i > 0) {
      x.fillStyle = colors[i - 1];
      const y = Math.round(y0 + i * bh);
      for (let k = 0; k < w; k += 2) x.fillRect(k + (i % 2), y, 1, 1);
    }
  });
}

export function buildScene() {
  if (L.sky) return;
  const rand = rng(1987);

  // sky with a striped retro sun sitting on the horizon
  {
    const [c, x] = canvas(SW, SURF_Y);
    bands(x, SKY, 0, SURF_Y, SW);
    const cx = 236, cy = 44, r = 26;
    const sun = ['#fff3b0', '#ffe28a', '#ffc86e', '#ffa860', '#ff8a5c'];
    for (let j = cy - r; j < SURF_Y; j++) {
      const band = Math.floor(((j - (cy - r)) / r) * sun.length);
      const gap = j > cy - 12 && (j - (cy - 12)) % 4 < Math.min(2, ((j - (cy - 12)) / 6) | 0);
      if (gap) continue;
      const half = Math.sqrt(Math.max(0, r * r - (j - cy) * (j - cy)));
      x.fillStyle = sun[Math.min(sun.length - 1, band)];
      x.fillRect(Math.round(cx - half), j, Math.round(half * 2), 1);
    }
    L.sky = c;
  }
  // clouds
  {
    const [c, x] = canvas(LW, SURF_Y);
    for (let i = 0; i < 9; i++) {
      const cx = rand() * LW, cy = 8 + rand() * 18, n = 3 + ((rand() * 4) | 0);
      for (const dx of [-LW, 0, LW]) {
        for (let k = 0; k < n; k++) {
          const r = 4 + rand() * 5, ox = cx + dx + (k - n / 2) * 7, oy = cy + rand() * 3;
          x.drawImage(disc(r, '#c06a9a'), ox - r, oy - r + 1);
          x.drawImage(disc(r - 1, '#f2a6b8'), ox - r + 1, oy - r);
        }
      }
    }
    L.clouds = c;
  }
  // distant islands with palms, sitting on the horizon
  {
    const [c, x] = canvas(LW, SURF_Y);
    x.fillStyle = '#3a1f56';
    const isles = [[60, 70, 9], [250, 110, 12], [470, 60, 7]];
    for (const [ix, iw, ih] of isles) {
      for (let i = 0; i < iw; i++) {
        const top = SURF_Y - Math.sin((i / iw) * Math.PI) * ih;
        x.fillRect(ix + i, Math.round(top), 1, SURF_Y - Math.round(top));
      }
      // a palm
      const px = ix + iw * 0.45, base = SURF_Y - ih;
      for (let k = 0; k < 10; k++) x.fillRect(Math.round(px + k * 0.3), base - k, 1, 1);
      const top = [px + 3, base - 10];
      for (const [dx, dy] of [[-5, 2], [-3, 0], [3, 0], [5, 2], [0, -1]]) {
        for (let k = 0; k < 4; k++) x.fillRect(Math.round(top[0] + (dx * k) / 4), Math.round(top[1] + (dy * k) / 4 + (k * k) / 6), 2, 1);
      }
    }
    L.islands = c;
  }
  // the water itself, dark toward the bottom
  {
    const [c, x] = canvas(SW, BED_Y - SURF_Y);
    bands(x, SEA, 0, BED_Y - SURF_Y, SW);
    L.sea = c;
  }
  // three rock layers: far (dim), middle, near seabed with sand and coral
  L.far = rocks(rand, { base: 150, amp: 26, color: '#123064', edge: '#1c4380' });
  L.mid = rocks(rand, { base: 182, amp: 18, color: '#16386e', edge: '#25528f', boulders: 6 });
  L.near = seabed(rand);

  // kelp plants in the middle and near layers
  L.kelp = [];
  for (let i = 0; i < 9; i++) L.kelp.push({ layer: 'mid', x: rand() * LW, h: 40 + rand() * 50, ph: rand() * 6, base: 196 + rand() * 10 });
  for (let i = 0; i < 7; i++) L.kelp.push({ layer: 'near', x: rand() * LW, h: 30 + rand() * 40, ph: rand() * 6, base: 226 });
  // fish schools, bubbles, specks
  L.fish = Array.from({ length: 3 }, () => newSchool(rand, true));
  L.snow = Array.from({ length: 46 }, () => ({ x: rand() * LW, y: SURF_Y + rand() * (BED_Y - SURF_Y), s: 0.08 + rand() * 0.18, w: rand() * 6 }));
  L.vents = [90, 300, 520].map((x) => ({ x }));
  L.bubbles = [];
  L.rand = rand;
}

function rocks(rand, { base, amp, color, edge, boulders = 0 }) {
  const [c, x] = canvas(LW, SH);
  const h = ridge(rand, base, amp, 5);
  for (let i = 0; i < LW; i++) {
    const top = Math.round(h(i));
    x.fillStyle = color;
    x.fillRect(i, top, 1, SH - top);
    x.fillStyle = edge;
    x.fillRect(i, top, 1, 2);
    // dithered shading under the edge
    for (let j = top + 4; j < top + 14; j += 2) if ((i + j) % 4 === 0) x.fillRect(i, j, 1, 1);
  }
  for (let b = 0; b < boulders; b++) {
    const bx = rand() * LW, r = 6 + rand() * 9, by = h(bx) + 4;
    for (const dx of [-LW, 0, LW]) {
      x.drawImage(disc(r, color), bx + dx - r, by - r);
      x.drawImage(disc(r - 3, edge), bx + dx - r + 1, by - r + 1);
      x.drawImage(disc(r - 4, color), bx + dx - r + 3, by - r + 3);
    }
  }
  return c;
}

function seabed(rand) {
  const [c, x] = canvas(LW, SH);
  const h = ridge(rand, 216, 3, 4);
  const sand = ['#c8a26a', '#b28a56', '#9a7446', '#7e5c38'];
  for (let i = 0; i < LW; i++) {
    const top = Math.round(h(i));
    for (let j = top; j < SH; j++) {
      const band = Math.min(sand.length - 1, Math.floor((j - top) / 5));
      x.fillStyle = sand[band];
      if ((i * 7 + j * 13) % 23 === 0) x.fillStyle = sand[Math.max(0, band - 1)];
      x.fillRect(i, j, 1, 1);
    }
    x.fillStyle = '#e6c890';
    x.fillRect(i, top, 1, 1);
  }
  // rocks and coral along the sand
  const corals = ['#ff6a8a', '#ff9a5a', '#c070e0', '#5ad0c0'];
  for (let k = 0; k < 14; k++) {
    const cx = rand() * LW, base = h(cx);
    for (const dx of [-LW, 0, LW]) {
      if (k % 3 === 0) {
        const r = 5 + rand() * 6;
        x.drawImage(disc(r, '#3a4660'), cx + dx - r, base - r + 3);
        x.drawImage(disc(r - 2, '#56637e'), cx + dx - r + 1, base - r + 2);
      } else {
        // branching coral
        const col = corals[k % corals.length];
        x.fillStyle = col;
        const branch = (bx, by, len, ang, depth) => {
          for (let s = 0; s < len; s++) x.fillRect(Math.round(bx + Math.sin(ang) * s), Math.round(by - Math.cos(ang) * s), 2, 2);
          if (depth > 0) {
            const ex = bx + Math.sin(ang) * len, ey = by - Math.cos(ang) * len;
            branch(ex, ey, len * 0.7, ang - 0.6, depth - 1);
            branch(ex, ey, len * 0.7, ang + 0.5, depth - 1);
          }
        };
        branch(cx + dx, base + 1, 6 + rand() * 4, (rand() - 0.5) * 0.4, 2);
      }
    }
  }
  return c;
}

function newSchool(rand, anywhere) {
  const dir = rand() < 0.5 ? 1 : -1;
  return {
    x: anywhere ? rand() * SW : dir > 0 ? -60 : SW + 60,
    y: 80 + rand() * 100, dir, speed: 0.25 + rand() * 0.3, n: 4 + ((rand() * 5) | 0),
    color: ['#b8d4e8', '#f2c46a', '#e88aa8'][(rand() * 3) | 0], ph: rand() * 6,
  };
}

/** The surface height at a screen x: two slow overlapping swells. */
export function waveY(x, t = SC.t) {
  return Math.sin(x * 0.045 + t * 0.05) * 1.6 + Math.sin(x * 0.12 - t * 0.032) * 0.8;
}

/** Advance the scenery one 1/60 s tick. `subX` is the sub's game x when there is one. */
export function stepScene(subX) {
  SC.t++;
  SC.drift += 0.18;
  SC.camTarget = subX === undefined ? Math.sin(SC.t * 0.004) * 40 : (subX - 74) * 2;
  SC.cam += (SC.camTarget - SC.cam) * 0.05;

  for (const f of L.fish) {
    f.x += f.dir * f.speed;
    if ((f.dir > 0 && f.x > SW + 80) || (f.dir < 0 && f.x < -80)) Object.assign(f, newSchool(L.rand, false));
  }
  for (const s of L.snow) { s.y += s.s; if (s.y > BED_Y) { s.y = SURF_Y; s.x = L.rand() * LW; } }
  if (SC.t % 14 === 0) {
    const v = L.vents[(SC.t / 14) % L.vents.length | 0];
    L.bubbles.push({ x: v.x + (L.rand() - 0.5) * 6, y: 218, r: 1 + L.rand() * 1.5, vy: 0.4 + L.rand() * 0.3, layer: 0.7 });
  }
  for (const b of L.bubbles) b.y -= b.vy;
  L.bubbles = L.bubbles.filter((b) => b.y > SURF_Y + 2);
}

const off = (factor) => SC.drift * factor + SC.cam * factor * 1.4;
function tile(ctx, img, factor, y = 0) {
  const x = -mod(off(factor), LW);
  ctx.drawImage(img, Math.round(x), y);
  ctx.drawImage(img, Math.round(x + LW), y);
}

function kelp(ctx, k, factor, dark) {
  const sx = mod(k.x - off(factor), LW) - 20;
  if (sx > SW + 20) return;
  const segs = Math.round(k.h / 4);
  let x = sx;
  for (let s = 0; s < segs; s++) {
    const sway = Math.sin(SC.t * 0.025 + s * 0.35 + k.ph) * (s * 0.18);
    const px = Math.round(x + sway), py = Math.round(k.base - s * 4);
    ctx.fillStyle = dark ? '#1c5a48' : '#2e8a4e';
    ctx.fillRect(px, py - 4, 2, 4);
    if (s % 2 === 0 && s > 1) {
      ctx.fillStyle = dark ? '#247058' : '#4ab06a';
      ctx.fillRect(px + (s % 4 === 0 ? 2 : -3), py - 3, 3, 2);
    }
  }
}

/** Everything behind the game objects. */
export function drawBack(ctx) {
  ctx.drawImage(L.sky, 0, 0);
  tile(ctx, L.clouds, 0.06);
  tile(ctx, L.islands, 0.12);
  ctx.drawImage(L.sea, 0, SURF_Y);

  // light rays from the surface, swaying
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const base = mod(i * 80 + 20 - off(0.3), SW + 80) - 40;
    const sway = Math.sin(SC.t * 0.01 + i) * 10;
    const a = 0.05 + 0.03 * Math.sin(SC.t * 0.02 + i * 1.7);
    ctx.fillStyle = `rgba(170,215,255,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(base, SURF_Y);
    ctx.lineTo(base + 14, SURF_Y);
    ctx.lineTo(base + 70 + sway, BED_Y);
    ctx.lineTo(base + 30 + sway, BED_Y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  tile(ctx, L.far, 0.2);
  // fish schools between the far and middle rocks
  for (const f of L.fish) {
    for (let i = 0; i < f.n; i++) {
      const fx = Math.round(f.x - (i % 3) * 7 * f.dir + Math.sin(SC.t * 0.05 + i) * 2);
      const fy = Math.round(f.y + Math.floor(i / 3) * 5 + (i % 3) * 3 + Math.sin(SC.t * 0.04 + f.ph + i) * 2);
      const tail = (SC.t >> 3) % 2;
      ctx.fillStyle = f.color;
      ctx.fillRect(fx, fy, 4, 2);
      ctx.fillRect(fx + (f.dir > 0 ? -2 : 4), fy + (tail ? 0 : 1) - 0, 2, 1);
      ctx.fillStyle = '#0d1024';
      ctx.fillRect(fx + (f.dir > 0 ? 3 : 0), fy, 1, 1);
    }
  }
  tile(ctx, L.mid, 0.4);
  for (const k of L.kelp) if (k.layer === 'mid') kelp(ctx, k, 0.4, true);
  // vent bubbles
  for (const b of L.bubbles) {
    const x = mod(b.x - off(b.layer), LW) + Math.sin((SC.t + b.y) * 0.08) * 2;
    if (x < SW + 4) ctx.drawImage(ringPx(b.r), Math.round(x), Math.round(b.y));
  }
  tile(ctx, L.near, 0.75);
  for (const k of L.kelp) if (k.layer === 'near') kelp(ctx, k, 0.75, false);
  // shimmer on the sand
  ctx.fillStyle = 'rgba(255,240,200,0.55)';
  for (let x = 0; x < SW; x += 3) {
    const v = Math.sin(x * 0.11 + SC.t * 0.06) + Math.sin(x * 0.07 - SC.t * 0.045);
    if (v > 1.3) ctx.fillRect(x, 218 + ((x * 5) % 4), 2, 1);
  }
  drawSurface(ctx);
}

const bubbleCache = new Map();
function ringPx(r) {
  r = Math.max(1, Math.round(r));
  if (!bubbleCache.has(r)) {
    const [c, x] = canvas(r * 2 + 2, r * 2 + 2);
    x.fillStyle = 'rgba(200,240,255,0.85)';
    for (let a = 0; a < 16; a++) x.fillRect(Math.round(r + Math.cos((a / 16) * Math.PI * 2) * r), Math.round(r + Math.sin((a / 16) * Math.PI * 2) * r), 1, 1);
    x.fillStyle = '#ffffff';
    x.fillRect(Math.round(r * 0.6), Math.round(r * 0.6), 1, 1);
    bubbleCache.set(r, c);
  }
  return bubbleCache.get(r);
}
export { ringPx as bubble };

/** The moving waterline: swells, a lighter crest and travelling glints. */
function drawSurface(ctx) {
  for (let x = 0; x < SW; x++) {
    const wy = Math.round(SURF_Y + waveY(x));
    if (wy < SURF_Y) { ctx.fillStyle = SEA[0]; ctx.fillRect(x, wy, 1, SURF_Y - wy); }
    else if (wy > SURF_Y) { ctx.fillStyle = SKY[SKY.length - 1]; ctx.fillRect(x, SURF_Y, 1, wy - SURF_Y); }
    ctx.fillStyle = (x + ((SC.t / 3) | 0)) % 11 < 3 ? '#ffffff' : '#9ad0ff';
    ctx.fillRect(x, wy, 1, 1);
    ctx.fillStyle = '#5a9ae0';
    ctx.fillRect(x, wy + 1, 1, 1);
  }
}

/** Specks drifting in front of everything, for depth. */
export function drawFront(ctx) {
  ctx.fillStyle = 'rgba(220,235,255,0.5)';
  for (const s of L.snow) {
    const x = mod(s.x - off(0.9) + Math.sin(SC.t * 0.02 + s.w) * 4, LW);
    if (x < SW) ctx.fillRect(Math.round(x), Math.round(s.y), 1, 1);
  }
}
