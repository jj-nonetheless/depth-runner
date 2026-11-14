// A small ray tracer (sphere tracing over signed distance fields) that pre-renders the start screen
// backdrop the way 1980s box art and demo-scene intros were made: a glossy submarine breaking the
// surface in front of a striped sunset sun, on a sea with a neon grid that reflects the sky and the sub.
// Output is a float RGB buffer, rendered a few rows at a time so the page can show it being traced.

export const RW = 320;
export const RH = 240;

// ---------- camera
const RO = [0, 0.42, -3.1];
const TARGET = [0.05, 0.36, 0];
const FOV = 0.5;
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const FWD = norm([TARGET[0] - RO[0], TARGET[1] - RO[1], TARGET[2] - RO[2]]);
const RIGHT = norm([FWD[2], 0, -FWD[0]]);
const UP = [FWD[1] * RIGHT[2] - FWD[2] * RIGHT[1], FWD[2] * RIGHT[0] - FWD[0] * RIGHT[2], FWD[0] * RIGHT[1] - FWD[1] * RIGHT[0]];

const SUN = norm([-0.4, 0.1, 1]);
const KEY = norm([0.7, 0.75, -0.6]); // a key light from front right, so the near side of the sub reads

// ---------- the submarine, in its own space
const C = [0.38, 0.05, 0.25];
const YAW = -0.48, ROLL = 0.07;
const cy = Math.cos(YAW), sy = Math.sin(YAW), cr = Math.cos(ROLL), sr = Math.sin(ROLL);
let mat = 0; // material of the last sdSub call: 1 hull, 2 tower, 3 fins, 4 propeller, 5 periscope
let lx = 0, ly = 0, lz = 0; // last local point, for decals

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function box(x, y, z, hx, hy, hz, r) {
  const qx = Math.abs(x) - hx + r, qy = Math.abs(y) - hy + r, qz = Math.abs(z) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
function sdSub(px, py, pz) {
  let x = px - C[0], y = py - C[1], z = pz - C[2];
  const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
  x = x1 * cr - y * sr; y = x1 * sr + y * cr; z = z1;
  lx = x; ly = y; lz = z;
  // hull: a capsule that tapers toward the tail
  const qx = x - clamp(x, -0.78, 0.72);
  const r = 0.24 - Math.max(0, -x - 0.25) * 0.13;
  let d = Math.hypot(qx, y, z * 1.08) - r;
  mat = 1;
  const tower = box(x - 0.1, y - 0.27, z, 0.17, 0.13, 0.07, 0.04);
  if (tower < d) { d = tower; mat = 2; }
  const planes = box(x - 0.12, y - 0.3, z, 0.04, 0.012, 0.17, 0.01);
  if (planes < d) { d = planes; mat = 3; }
  const scope = Math.max(Math.hypot(x - 0.17, z) - 0.018, Math.abs(y - 0.47) - 0.09);
  if (scope < d) { d = scope; mat = 5; }
  const finV = box(x + 0.98, y, z, 0.09, 0.2, 0.012, 0.01);
  if (finV < d) { d = finV; mat = 3; }
  const finH = box(x + 0.98, y, z, 0.09, 0.012, 0.2, 0.01);
  if (finH < d) { d = finH; mat = 3; }
  const prop = box(x + 1.08, y, z, 0.012, 0.09, 0.09, 0.03);
  if (prop < d) { d = prop; mat = 4; }
  return d;
}

// ---------- sky: banded sunset, a striped sun, a glow and a few stars
const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
const mix = (a, b, t) => a + (b - a) * t;
function sky(dx, dy, dz, out, noStars) {
  if (dy < -0.02) { out[0] = 0.05; out[1] = 0.02; out[2] = 0.1; return out; }
  const t = Math.max(0, dy);
  // horizon pink -> magenta -> violet -> night
  const stops = [[0, 1.0, 0.55, 0.42], [0.06, 1.0, 0.32, 0.55], [0.18, 0.55, 0.16, 0.62], [0.36, 0.16, 0.06, 0.32], [0.7, 0.04, 0.02, 0.12]];
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const a = stops[i], b = stops[i + 1], k = clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
  out[0] = mix(a[1], b[1], k); out[1] = mix(a[2], b[2], k); out[2] = mix(a[3], b[3], k);
  const cs = dx * SUN[0] + dy * SUN[1] + dz * SUN[2];
  const glow = Math.pow(Math.max(0, cs), 60) * 0.55;
  out[0] += glow; out[1] += glow * 0.45; out[2] += glow * 0.3;
  if (cs > 0.982) {
    // inside the sun: yellow at the top, pink at the bottom, cut by widening stripes below the middle
    const sv = (dy - SUN[1]) / 0.19; // -1 bottom .. 1 top
    const stripe = sv < 0.1 && ((sv * 9 + 20) % 1) < clamp(0.15 - sv * 0.45, 0, 0.7);
    if (!stripe) {
      const s = clamp((sv + 1) / 2, 0, 1);
      out[0] = 1.0; out[1] = mix(0.3, 0.95, s); out[2] = mix(0.55, 0.45, s);
    }
  }
  if (!noStars && t > 0.22 && hash(Math.floor(dx * 260), Math.floor(dy * 260)) > 0.994) { out[0] = out[1] = out[2] = 0.95; }
  return out;
}

// ---------- shading
const tmp = [0, 0, 0];
const BASE = { 1: [1.0, 0.8, 0.12], 2: [1.0, 0.76, 0.1], 3: [0.95, 0.45, 0.1], 4: [0.85, 0.7, 0.35], 5: [0.8, 0.82, 0.88] };
function shadeSub(x, y, z, dx, dy, dz, out, simple) {
  // normal from four samples (tetrahedron technique)
  const e = 0.002;
  const f1 = sdSub(x + e, y - e, z - e), f2 = sdSub(x - e, y - e, z + e), f3 = sdSub(x - e, y + e, z - e), f4 = sdSub(x + e, y + e, z + e);
  const nx = f1 - f2 - f3 + f4, ny = -f1 - f2 + f3 + f4, nz = -f1 + f2 - f3 + f4;
  sdSub(x, y, z);
  const m = mat, px = lx, py = ly, pz = lz;
  const nl = Math.hypot(nx, ny, nz);
  const n0 = nx / nl, n1 = ny / nl, n2 = nz / nl;
  let [br, bg, bb] = BASE[m];
  if (m === 1) {
    // red waterline stripe, darker below it, round portholes along the side facing us
    if (py < -0.03 && py > -0.075) { br = 0.85; bg = 0.12; bb = 0.1; }
    else if (py <= -0.075) { br = 0.55; bg = 0.1; bb = 0.12; }
    const cell = ((px + 0.62) / 0.2) % 1;
    if (pz < -0.12 && px > -0.6 && px < 0.55 && Math.hypot((cell - 0.5) * 0.2, py - 0.06) < 0.035) { br = 0.2; bg = 0.55; bb = 0.9; }
  }
  const diff = Math.max(0, n0 * KEY[0] + n1 * KEY[1] + n2 * KEY[2]);
  const cosv = Math.max(0, -(n0 * dx + n1 * dy + n2 * dz));
  const dn = dx * n0 + dy * n1 + dz * n2;
  const rx = dx - 2 * dn * n0, ry = dy - 2 * dn * n1, rz = dz - 2 * dn * n2;
  const chrome = m === 4 || m === 5;
  const fres = chrome ? 0.85 : 0.12 + 0.88 * Math.pow(1 - cosv, 5);
  sky(rx, ry, rz, tmp);
  const hx = KEY[0] - dx, hy = KEY[1] - dy, hz = KEY[2] - dz, hl = Math.hypot(hx, hy, hz);
  const spec = simple ? 0 : Math.pow(Math.max(0, (n0 * hx + n1 * hy + n2 * hz) / hl), 60) * 1.4;
  const rim = Math.pow(1 - cosv, 3) * 0.7;
  const lit = 0.28 + diff * 0.85;
  const k = chrome ? 0.35 : 1;
  out[0] = br * lit * k + tmp[0] * fres * 0.9 + spec + rim * 1.0;
  out[1] = bg * lit * k + tmp[1] * fres * 0.9 + spec + rim * 0.4;
  out[2] = bb * lit * k + tmp[2] * fres * 0.9 + spec + rim * 0.65;
  return out;
}

function march(ox, oy, oz, dx, dy, dz, maxT, steps) {
  let t = 0.02;
  for (let i = 0; i < steps && t < maxT; i++) {
    const d = sdSub(ox + dx * t, oy + dy * t, oz + dz * t);
    if (d < 0.0015) return t;
    t += d;
  }
  return -1;
}

const sub = [0, 0, 0];
function shadeSea(x, z, dx, dy, dz, t, out) {
  const dist = t;
  // reflection: the sky, and the sub if the reflected ray finds it
  // ripples break the reflection into the horizontal streaks of a calm sea at sunset
  const rip = (Math.sin(z * 22 + Math.sin(x * 3) * 2) * 0.035 + Math.sin(z * 57 - x * 9) * 0.012) * Math.exp(-t * 0.18);
  const rx = dx, ry = -dy + rip, rz = dz;
  sky(rx, ry, rz, out, true);
  const tr = march(x, 0, z, rx, ry, rz, 3, 48);
  if (tr > 0) { shadeSub(x + rx * tr, ry * tr, z + rz * tr, rx, ry, rz, sub, true); out[0] = sub[0]; out[1] = sub[1]; out[2] = sub[2]; }
  const fres = 0.2 + 0.45 * Math.pow(1 - Math.abs(dy), 4);
  let r = 0.05 + out[0] * fres, g = 0.02 + out[1] * fres, b = 0.12 + out[2] * fres;
  // neon grid, fading with distance
  const gx = Math.abs(((x * 2.2) % 1 + 1) % 1 - 0.5), gz = Math.abs(((z * 2.2) % 1 + 1) % 1 - 0.5);
  const w = 0.03 + dist * 0.004;
  const line = Math.max(clamp(1 - (0.5 - gx) / w, 0, 1), clamp(1 - (0.5 - gz) / w, 0, 1));
  const fade = Math.exp(-dist * 0.12);
  r += line * fade * 1.0; g += line * fade * 0.18; b += line * fade * 0.75;
  // foam where the hull meets the water
  const ds = sdSub(x, 0, z);
  if (ds < 0.05) { const f = 1 - ds / 0.05; r = mix(r, 1, f * 0.8); g = mix(g, 0.95, f * 0.8); b = mix(b, 1, f * 0.8); }
  // haze toward the horizon
  const haze = 1 - Math.exp(-dist * 0.06);
  out[0] = mix(r, 0.95, haze * 0.6); out[1] = mix(g, 0.4, haze * 0.6); out[2] = mix(b, 0.5, haze * 0.6);
  return out;
}

const col = [0, 0, 0];
/** Trace one row of pixels into `buf` (Float32Array, RW*RH*3). */
export function traceRow(j, buf) {
  const aspect = RW / RH;
  for (let i = 0; i < RW; i++) {
    const u = ((i + 0.5) / RW * 2 - 1) * aspect * FOV;
    const v = (1 - (j + 0.5) / RH * 2) * FOV;
    let dx = FWD[0] + RIGHT[0] * u + UP[0] * v, dy = FWD[1] + RIGHT[1] * u + UP[1] * v, dz = FWD[2] + RIGHT[2] * u + UP[2] * v;
    const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
    const tPlane = dy < 0 ? -RO[1] / dy : Infinity;
    const tSub = march(RO[0], RO[1], RO[2], dx, dy, dz, Math.min(tPlane, 8), 90);
    if (tSub > 0) shadeSub(RO[0] + dx * tSub, RO[1] + dy * tSub, RO[2] + dz * tSub, dx, dy, dz, col, false);
    else if (tPlane < Infinity) shadeSea(RO[0] + dx * tPlane, RO[2] + dz * tPlane, dx, dy, dz, tPlane, col);
    else sky(dx, dy, dz, col);
    const k = (j * RW + i) * 3;
    buf[k] = col[0]; buf[k + 1] = col[1]; buf[k + 2] = col[2];
  }
}

/** Where the sun lands on screen, for the lens flare. */
export function sunOnScreen() {
  const fx = SUN[0] * FWD[0] + SUN[1] * FWD[1] + SUN[2] * FWD[2];
  const u = (SUN[0] * RIGHT[0] + SUN[1] * RIGHT[1] + SUN[2] * RIGHT[2]) / fx / FOV / (RW / RH);
  const v = (SUN[0] * UP[0] + SUN[1] * UP[1] + SUN[2] * UP[2]) / fx / FOV;
  return [((u + 1) / 2) * RW, ((1 - v) / 2) * RH];
}
