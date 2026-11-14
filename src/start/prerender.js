// Runs the ray tracer a slice at a time, and keeps the finished render in this browser so the
// start screen only has to trace it once.
import { traceRow, RW, RH } from './raytrace.js';

const KEY = 'depthrunner.prerender.v3';

export function createTracer() {
  const buf = new Float32Array(RW * RH * 3);
  let row = 0;
  return {
    buf,
    get row() { return row; },
    get done() { return row >= RH; },
    /** Trace up to `maxRows` rows within `ms` milliseconds; returns [first, end) of the rows traced. */
    step(ms, maxRows = Infinity) {
      const from = row, t0 = performance.now();
      while (row < RH && row - from < maxRows && performance.now() - t0 < ms) traceRow(row++, buf);
      return [from, row];
    },
  };
}

export function saveRender(buf) {
  try {
    const c = document.createElement('canvas');
    c.width = RW; c.height = RH;
    const x = c.getContext('2d');
    const img = x.createImageData(RW, RH);
    for (let i = 0, k = 0; i < buf.length; i += 3, k += 4) {
      img.data[k] = Math.min(255, buf[i] * 255); img.data[k + 1] = Math.min(255, buf[i + 1] * 255); img.data[k + 2] = Math.min(255, buf[i + 2] * 255); img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    localStorage.setItem(KEY, c.toDataURL('image/png'));
  } catch { /* storage full or blocked: it will be traced again next time */ }
}

/** The saved render as a float buffer, or null. */
export function loadRender() {
  let url = null;
  try { url = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  if (!url || !url.startsWith('data:image/png')) return Promise.resolve(null);
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = RW; c.height = RH;
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, RW, RH).data;
      const buf = new Float32Array(RW * RH * 3);
      for (let i = 0, k = 0; i < buf.length; i += 3, k += 4) { buf[i] = d[k] / 255; buf[i + 1] = d[k + 1] / 255; buf[i + 2] = d[k + 2] / 255; }
      resolve(buf);
    };
    im.onerror = () => resolve(null);
    im.src = url;
  });
}
