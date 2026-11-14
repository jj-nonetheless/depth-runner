// The chrome logo, pre-rendered like 1980s title art: italic block letters with a bevelled edge, a
// mirror finish reflecting sky over ground with a hard horizon line through the middle, a stacked
// magenta-to-violet extrusion behind, a dark outline and a neon glow.
export const LOGO_W = 320;
export const LOGO_H = 104;

function mask(text, y, size) {
  const c = document.createElement('canvas');
  c.width = LOGO_W; c.height = LOGO_H;
  const x = c.getContext('2d');
  x.font = `${size}px "Press Start 2P", "Arial Black", Impact, sans-serif`;
  x.textAlign = 'center';
  x.textBaseline = 'top';
  x.setTransform(1, 0, -0.22, 1, 14, 0); // italic lean
  x.fillStyle = '#fff';
  x.strokeStyle = '#fff';
  x.lineWidth = 3; // fatten the pixel font's strokes so the chrome has a face to show
  x.lineJoin = 'miter';
  for (const [t, ty] of text) { x.fillText(t, LOGO_W / 2, ty); x.strokeText(t, LOGO_W / 2, ty); }
  return x.getImageData(0, 0, LOGO_W, LOGO_H).data;
}

export function buildLogo() {
  const W = LOGO_W, H = LOGO_H, N = W * H;
  const lines = [['DEPTH', 6], ['RUNNER', 52]];
  const raw = mask(lines, 0, 38);
  const inside = new Uint8Array(N);
  for (let i = 0; i < N; i++) inside[i] = raw[i * 4 + 3] > 110 ? 1 : 0;

  // distance to the nearest edge, inside the letters (two-pass chamfer)
  const dist = new Float32Array(N).fill(1e9);
  for (let i = 0; i < N; i++) if (!inside[i]) dist[i] = 0;
  const pass = (i, j, di, dj, w) => {
    const ii = i + di, jj = j + dj;
    if (ii < 0 || jj < 0 || ii >= W || jj >= H) return;
    const k = jj * W + ii, c = j * W + i;
    if (dist[k] + w < dist[c]) dist[c] = dist[k] + w;
  };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { pass(i, j, -1, 0, 1); pass(i, j, 0, -1, 1); pass(i, j, -1, -1, 1.4); pass(i, j, 1, -1, 1.4); }
  for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) { pass(i, j, 1, 0, 1); pass(i, j, 0, 1, 1); pass(i, j, 1, 1, 1.4); pass(i, j, -1, 1, 1.4); }
  const BEVEL = 2.5;
  const hgt = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? 0 : Math.min(dist[j * W + i], BEVEL) / BEVEL);
  const isIn = (i, j) => i >= 0 && j >= 0 && i < W && j < H && inside[j * W + i];

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const img = x.createImageData(W, H);
  const d = img.data;
  const put = (i, j, r, g, b, a = 255) => {
    if (i < 0 || j < 0 || i >= W || j >= H) return;
    const k = (j * W + i) * 4;
    d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = a;
  };
  // extrusion: the letter shape stacked down and to the right, magenta fading to violet
  const DEPTH = 7;
  for (let s = DEPTH; s >= 1; s--) {
    const f = s / DEPTH;
    const r = 255 * (1 - f) + 70 * f, g = 40 * (1 - f) + 10 * f, b = 160 * (1 - f) + 110 * f;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (inside[j * W + i]) put(i + s, j + s, r, g, b);
  }
  // dark outline around the face
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if (inside[j * W + i]) continue;
      let near = false;
      for (let dj = -2; dj <= 2 && !near; dj++) for (let di = -2; di <= 2; di++) if (Math.abs(di) + Math.abs(dj) <= 3 && isIn(i + di, j + dj)) { near = true; break; }
      if (near) put(i, j, 14, 6, 34);
    }
  }
  // the chrome face
  const lineTop = (j) => (j < 49 ? 6 : 52);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if (!inside[j * W + i]) continue;
      const nx = (hgt(i - 1, j) - hgt(i + 1, j)) * 1.6, ny = (hgt(i, j - 1) - hgt(i, j + 1)) * 1.6;
      const nl = Math.hypot(nx, ny, 1);
      const n0 = nx / nl, n1 = ny / nl, n2 = 1 / nl;
      // position down the letter (0 top .. 1 bottom) plus the bevel's tilt picks sky or ground
      const v = (j - lineTop(j)) / 38;
      const e = v - 0.52 - n1 * 0.35 + n0 * 0.08;
      let r, g, b;
      if (e < 0) {
        const t = Math.min(1, -e / 0.55); // sky: pale cyan at the horizon to deep blue at the top
        r = 200 - 170 * t; g = 240 - 160 * t; b = 255 - 60 * t;
      } else {
        const t = Math.min(1, e / 0.45); // ground: dark brown at the horizon to hot orange below
        r = 70 + 185 * t; g = 25 + 125 * t; b = 20 + 40 * t;
      }
      if (Math.abs(e) < 0.035) { r = 255; g = 255; b = 255; } // the horizon line
      // highlight on edges facing the light (up and left)
      const spec = Math.pow(Math.max(0, -n0 * 0.5 - n1 * 0.8 + n2 * 0.3), 6) * 220;
      put(i, j, Math.min(255, r + spec), Math.min(255, g + spec), Math.min(255, b + spec));
    }
  }
  x.putImageData(img, 0, 0);

  // neon glow, kept smooth (drawn under the dithered face rather than dithered with it)
  const glow = document.createElement('canvas');
  glow.width = W; glow.height = H;
  const gx = glow.getContext('2d');
  const tint = document.createElement('canvas');
  tint.width = W; tint.height = H;
  const tx = tint.getContext('2d');
  tx.drawImage(c, 0, 0);
  tx.globalCompositeOperation = 'source-in';
  tx.fillStyle = '#ff3aa8';
  tx.fillRect(0, 0, W, H);
  gx.filter = 'blur(5px)';
  gx.drawImage(tint, 0, 0);
  gx.filter = 'none';

  // spots on the edges where sparkles can appear
  const sparks = [];
  for (let j = 2; j < H - 2; j += 3) for (let i = 2; i < W - 2; i += 3) if (inside[j * W + i] && dist[j * W + i] <= 1.5 && j % 9 === 2) sparks.push([i, j]);
  return { glow, art: c, sparks };
}
