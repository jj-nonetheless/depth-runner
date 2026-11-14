// Squeeze a full-colour render into a period palette with ordered (Bayer) dithering, the way
// pre-rendered art had to be converted for the hardware:
//   16-bit look: 3 bits per channel, the 512-colour palette of a Mega Drive, at full resolution
//   8-bit look:  the 16 fixed colours of a Commodore 64, at half resolution
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const C64 = ['000000', 'FFFFFF', '68372B', '70A4B2', '6F3D86', '588D43', '352879', 'B8C76F',
  '6F4F25', '433900', '9A6759', '444444', '6C6C6C', '9AD284', '6C5EB5', '959595']
  .map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));

function nearestC64(r, g, b) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < C64.length; i++) {
    const c = C64[i], d = (r - c[0]) ** 2 * 0.3 + (g - c[1]) ** 2 * 0.59 + (b - c[2]) ** 2 * 0.11;
    if (d < bd) { bd = d; best = i; }
  }
  return C64[best];
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** read(x, y) -> [r, g, b, a] in 0..1 for a w x h source; returns a dithered canvas */
function convert(w, h, read, look) {
  const half = look === '8';
  const ow = half ? w >> 1 : w, oh = half ? h >> 1 : h;
  const c = document.createElement('canvas');
  c.width = ow; c.height = oh;
  const x = c.getContext('2d');
  const img = x.createImageData(ow, oh);
  const d = img.data;
  for (let j = 0; j < oh; j++) {
    for (let i = 0; i < ow; i++) {
      let r, g, b, a;
      if (half) {
        // average each 2x2 block
        r = g = b = a = 0;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const p = read(i * 2 + dx, j * 2 + dy); r += p[0]; g += p[1]; b += p[2]; a += p[3]; }
        r /= 4; g /= 4; b /= 4; a /= 4;
      } else [r, g, b, a] = read(i, j);
      const k = (j * ow + i) * 4;
      if (a < 0.5) { d[k + 3] = 0; continue; }
      const t = BAYER[(j & 3) * 4 + (i & 3)];
      if (half) {
        const o = (t - 0.5) * 0.28;
        const p = nearestC64(clamp01(r + o), clamp01(g + o), clamp01(b + o));
        d[k] = p[0] * 255; d[k + 1] = p[1] * 255; d[k + 2] = p[2] * 255;
      } else {
        d[k] = (Math.floor(clamp01(r) * 7 + t) / 7) * 255;
        d[k + 1] = (Math.floor(clamp01(g) * 7 + t) / 7) * 255;
        d[k + 2] = (Math.floor(clamp01(b) * 7 + t) / 7) * 255;
      }
      d[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

/** A float RGB buffer (the ray tracer's output). */
export function ditherBuffer(buf, w, h, look) {
  const px = [0, 0, 0, 1];
  return convert(w, h, (x, y) => { const k = (y * w + x) * 3; px[0] = buf[k]; px[1] = buf[k + 1]; px[2] = buf[k + 2]; return px; }, look);
}

/** A canvas with transparency (the logo). */
export function ditherCanvas(src, look) {
  const data = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
  const px = [0, 0, 0, 0];
  return convert(src.width, src.height, (x, y) => {
    const k = (y * src.width + x) * 4;
    px[0] = data[k] / 255; px[1] = data[k + 1] / 255; px[2] = data[k + 2] / 255; px[3] = data[k + 3] / 255;
    return px;
  }, look);
}
