// The start screen: a pre-rendered title in the style of 1980s box art and demo-scene intros.
// First visit: the scene is ray traced line by line on screen, then dithered to the look's palette.
// Then the chrome logo crashes in, and attract mode runs (shine, lens flare, raster bars, a sine
// scroller, sparkles, and the Top 10 every so often) until the player presses start.
import { createSignal, onMount, onCleanup } from 'solid-js';
import { RW, RH, sunOnScreen } from '../start/raytrace.js';
import { createTracer, saveRender, loadRender } from '../start/prerender.js';
import { ditherBuffer, ditherCanvas } from '../start/dither.js';
import { buildLogo, LOGO_W, LOGO_H } from '../start/logo.js';
import { beep } from '../game/sound.js';
import { look } from '../look.js';
import { board } from '../net/scores.js';
import { net } from '../net/room.js';
import { goTitle } from '../controller.js';

/** loading | render | convert | intro | attract | leave (read by the tests) */
export const [startPhase, setStartPhase] = createSignal('loading');

const SCROLL = 'DEPTH RUNNER  ***  STEER THE SUB  ***  TORPEDO THE SHIPS  ***  CATCH THE POWER-UPS  ***  '
  + 'CHALLENGE A FRIEND IN THE ONLINE LOBBY  ***  8-BIT OR 16-BIT: PRESS G  ***  CAN YOU MAKE THE TOP 10?  ***  ';
const RASTER = [['#2a0a5a', '#7a2ac0', '#e070ff', '#ffffff', '#e070ff', '#7a2ac0', '#2a0a5a'],
  ['#3a1400', '#a04a00', '#ffb030', '#fff8c0', '#ffb030', '#a04a00', '#3a1400'],
  ['#002a3a', '#0a7aa0', '#40e0ff', '#e8ffff', '#40e0ff', '#0a7aa0', '#002a3a']];
const RASTER8 = [['#352879', '#6C5EB5', '#FFFFFF', '#6C5EB5', '#352879'], ['#68372B', '#9A6759', '#B8C76F', '#9A6759', '#68372B']];

function fanfare() {
  [[523, 0], [659, 70], [784, 140], [1047, 210], [1319, 280], [1568, 350]].forEach(([f, at]) => setTimeout(() => beep(f, 0.12), at));
  setTimeout(() => { beep(1047, 0.5); beep(1319, 0.5, 'square', 0.03); beep(262, 0.6, 'triangle', 0.08); }, 440);
}
const ease = (p) => 1 + 2.4 * Math.pow(p - 1, 3) + 1.4 * Math.pow(p - 1, 2); // ease out with an overshoot

export default function StartScreen() {
  let cv;
  let status;
  let raf = 0;
  let stopped = false; // set when the start screen goes away; nothing may run after that
  let handedOver = false;
  const finish = () => { if (!handedOver) { handedOver = true; goTitle(); } };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S = {
    t: 0, phaseT: 0, buf: null, tracer: null, raw: null, rawCtx: null,
    scene: {}, logo: null, logoArt: {}, shake: 0, flash: 0, sparks: [], scroll: 0, leaving: false,
  };
  const phase = (p) => { setStartPhase(p); S.phaseT = 0; };

  const press = () => {
    const p = startPhase();
    if (p === 'leave') return;
    if (p === 'loading' || p === 'render' || p === 'convert') { finish(); return; } // skip it all
    fanfare();
    phase('leave');
  };
  const onKey = (e) => {
    if (['Enter', 'Space', 'Escape', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); press(); }
  };

  const sceneFor = (l) => (S.scene[l] ||= ditherBuffer(S.buf, RW, RH, l));
  const logoFor = (l) => (S.logoArt[l] ||= ditherCanvas(S.logo.art, l));

  onMount(async () => {
    window.addEventListener('keydown', onKey);
    const x = cv.getContext('2d');
    x.imageSmoothingEnabled = false;
    if (document.fonts?.load) await Promise.race([document.fonts.load('38px "Press Start 2P"'), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});
    if (stopped) return;
    S.logo = buildLogo();
    S.buf = await loadRender();
    if (stopped) return;
    if (S.buf) phase('intro');
    else {
      S.tracer = createTracer();
      S.raw = document.createElement('canvas');
      S.raw.width = RW; S.raw.height = RH;
      S.rawCtx = S.raw.getContext('2d');
      phase('render');
    }
    const STEP = 1000 / 60;
    let last = performance.now(), acc = 0;
    const frame = (now) => {
      if (stopped) return;
      acc += Math.min(250, now - last);
      last = now;
      if (startPhase() === 'render') trace();
      while (acc >= STEP && !stopped) { tick(); acc -= STEP; }
      // tick() can hand over to the title, which removes this screen mid-frame: don't schedule another
      if (stopped) return;
      draw(x);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
  onCleanup(() => { stopped = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); });

  // ---------- tracing on screen
  function trace() {
    // two rows a frame: about two seconds to trace, slow enough to watch it happen
    const [from, to] = S.tracer.step(9, 2);
    if (to > from) {
      const img = S.rawCtx.createImageData(RW, to - from);
      const b = S.tracer.buf;
      for (let i = 0, k = from * RW * 3; i < img.data.length; i += 4, k += 3) {
        img.data[i] = Math.min(255, b[k] * 255); img.data[i + 1] = Math.min(255, b[k + 1] * 255); img.data[i + 2] = Math.min(255, b[k + 2] * 255); img.data[i + 3] = 255;
      }
      S.rawCtx.putImageData(img, 0, from);
      if (status) status.textContent = `Rendering the start screen: ${Math.round((to / RH) * 100)}%`;
    }
    if (S.tracer.done) {
      S.buf = S.tracer.buf;
      saveRender(S.buf);
      if (status) status.textContent = 'Start screen ready. Press start.';
      phase('convert');
    }
  }

  function tick() {
    S.t++; S.phaseT++;
    const p = startPhase();
    if (S.shake > 0) S.shake = Math.max(0, S.shake - 0.5);
    if (S.flash > 0) S.flash--;
    if (p === 'convert' && S.phaseT > 50) phase('intro');
    if (p === 'intro') {
      if (S.phaseT === 40 && !reduce) { S.flash = 12; S.shake = 9; }
      if (S.phaseT > (reduce ? 1 : 110)) phase('attract');
    }
    if (p === 'leave' && S.phaseT > 40) finish();
    if (!reduce) S.scroll += 1.2;
    // sparkles along the logo's edges
    if (!reduce && S.logo && (p === 'attract' || p === 'intro') && S.t % 9 === 0 && S.logo.sparks.length) {
      const [sx, sy] = S.logo.sparks[(Math.random() * S.logo.sparks.length) | 0];
      S.sparks.push({ x: sx, y: sy, t: 0 });
    }
    for (const s of S.sparks) s.t++;
    S.sparks = S.sparks.filter((s) => s.t < 24);
  }

  // ---------- drawing helpers
  function text(x, s, px, py, color, align = 'center') {
    x.font = '8px "Press Start 2P", monospace';
    x.textAlign = align; x.textBaseline = 'top';
    x.fillStyle = '#0a0420';
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [2, 2]]) x.fillText(s, px + dx, py + dy);
    x.fillStyle = color;
    x.fillText(s, px, py);
  }
  function drawScene(x, l) {
    const img = sceneFor(l);
    x.drawImage(img, 0, 0, RW, RH);
  }
  function drawLogo(x, l, y, scale = 1, alpha = 1) {
    const w = LOGO_W * scale, h = LOGO_H * scale, lx = (RW - w) / 2, ly = y - (h - LOGO_H) / 2;
    x.globalAlpha = alpha;
    if (l === '16') { x.globalCompositeOperation = 'lighter'; x.globalAlpha = alpha * (0.7 + 0.3 * Math.sin(S.t * 0.08)); x.drawImage(S.logo.glow, lx, ly, w, h); x.globalCompositeOperation = 'source-over'; x.globalAlpha = alpha; }
    x.drawImage(logoFor(l), lx, ly, w, h);
    // a shine sweeping across the chrome every few seconds
    const sw = (S.t % 240) / 240;
    if (!reduce && scale === 1 && startPhase() === 'attract' && sw < 0.35) {
      const sx = -60 + (sw / 0.35) * (LOGO_W + 120);
      const tmp = drawLogo.tmp ||= Object.assign(document.createElement('canvas'), { width: LOGO_W, height: LOGO_H });
      const tc = tmp.getContext('2d');
      tc.globalCompositeOperation = 'source-over';
      tc.clearRect(0, 0, LOGO_W, LOGO_H);
      tc.drawImage(S.logo.art, 0, 0);
      tc.globalCompositeOperation = 'source-in';
      const g = tc.createLinearGradient(sx - 30, 0, sx + 30, LOGO_H);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      tc.fillStyle = g;
      tc.fillRect(0, 0, LOGO_W, LOGO_H);
      x.globalCompositeOperation = 'lighter';
      x.drawImage(tmp, lx, ly);
      x.globalCompositeOperation = 'source-over';
    }
    x.globalAlpha = 1;
    for (const s of S.sparks) {
      const k = s.t < 12 ? s.t / 12 : (24 - s.t) / 12, r = Math.round(1 + k * 4);
      x.fillStyle = '#ffffff';
      x.fillRect(lx + s.x - r, ly + s.y, r * 2 + 1, 1);
      x.fillRect(lx + s.x, ly + s.y - r, 1, r * 2 + 1);
      x.fillStyle = '#ffe8a0';
      x.fillRect(lx + s.x - 1, ly + s.y - 1, 3, 3);
    }
  }
  function flare(x) {
    const [fx, fy] = sunOnScreen();
    const cx = RW / 2, cy = RH / 2, pulse = reduce ? 1 : 0.75 + 0.25 * Math.sin(S.t * 0.05);
    x.globalCompositeOperation = 'lighter';
    for (const [t, r, c] of [[0, 26, '255,200,140'], [0.35, 7, '255,120,200'], [0.6, 14, '140,200,255'], [0.9, 5, '255,240,160'], [1.25, 20, '200,120,255'], [1.6, 9, '120,255,220']]) {
      const px = fx + (cx - fx) * t * 2, py = fy + (cy - fy) * t * 2;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(${c},${(t === 0 ? 0.55 : 0.22) * pulse})`); g.addColorStop(1, `rgba(${c},0)`);
      x.fillStyle = g;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    x.globalCompositeOperation = 'source-over';
  }
  function rasterBars(x, l) {
    const bars = l === '8' ? RASTER8 : RASTER;
    bars.forEach((cols, b) => {
      const y = Math.round(192 + (reduce ? (b - 1) * 9 : Math.sin(S.t * 0.045 + b * 2.1) * 10));
      cols.forEach((c, i) => { x.fillStyle = c; x.fillRect(0, y + i * (l === '8' ? 2 : 1), RW, l === '8' ? 2 : 1); });
    });
  }
  function scroller(x) {
    x.font = '8px "Press Start 2P", monospace';
    x.textAlign = 'left'; x.textBaseline = 'top';
    const cw = 8, total = SCROLL.length * cw;
    const off = S.scroll % total;
    for (let i = 0; i < SCROLL.length * 2; i++) {
      const px = i * cw - off;
      if (px < -cw || px > RW) continue;
      const ch = SCROLL[i % SCROLL.length];
      const py = 226 + (reduce ? 0 : Math.round(Math.sin(px * 0.045 + S.t * 0.09) * 4));
      x.fillStyle = '#0a0420'; x.fillText(ch, px + 1, py + 1);
      x.fillStyle = `hsl(${(px * 1.2 + S.t * 2) % 360},100%,72%)`;
      x.fillText(ch, px, py);
    }
  }
  function scores(x) {
    const rows = (board.status === 'online' ? board.shared : board.local).slice(0, 10);
    x.fillStyle = 'rgba(10,4,32,0.86)';
    x.fillRect(40, 54, 240, 150);
    x.strokeStyle = '#ff3aa8'; x.lineWidth = 2; x.strokeRect(41, 55, 238, 148);
    x.strokeStyle = '#40e0ff'; x.lineWidth = 1; x.strokeRect(45.5, 59.5, 229, 139);
    text(x, 'HIGH SCORES', RW / 2, 66, (S.t >> 3) % 2 ? '#ffd060' : '#ff8a3a');
    if (!rows.length) { text(x, 'NO SCORES YET', RW / 2, 112, '#ffffff'); text(x, 'BE THE FIRST!', RW / 2, 128, '#40e0ff'); return; }
    rows.forEach((e, i) => {
      const y = 82 + i * 11, c = i === 0 ? '#ffd060' : i < 3 ? '#ffffff' : '#c8c0f0';
      text(x, String(i + 1).padStart(2, '0'), 60, y, '#ff70c0', 'left');
      text(x, e.name.slice(0, 10), 86, y, c, 'left');
      text(x, String(e.score).padStart(6, '0'), 260, y, c, 'right');
    });
  }

  function draw(x) {
    const p = startPhase(), l = look();
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#000';
    x.fillRect(0, 0, RW, RH);
    if (p === 'loading') { text(x, 'LOADING…', RW / 2, 114, '#ffffff'); return; }
    if (p === 'render') {
      const row = S.tracer.row;
      x.drawImage(S.raw, 0, 0, RW, row, 0, 0, RW, row);
      x.fillStyle = '#ffffff'; x.fillRect(0, row, RW, 1);
      x.fillStyle = 'rgba(160,220,255,0.35)'; x.fillRect(0, row + 1, RW, 3);
      x.fillStyle = 'rgba(0,0,20,0.8)'; x.fillRect(16, 168, 288, 58);
      x.strokeStyle = '#40e0ff'; x.lineWidth = 1; x.strokeRect(16.5, 168.5, 287, 57);
      text(x, 'RAY TRACING SCENE' + ((S.t >> 4) % 2 ? '_' : ' '), 26, 176, '#40e0ff', 'left');
      text(x, `LINE ${String(row).padStart(3, '0')}/${RH}  ${(row * RW).toLocaleString('en')} RAYS`, 26, 190, '#ffffff', 'left');
      x.fillStyle = '#1a1a40'; x.fillRect(26, 206, 268, 10);
      x.fillStyle = '#ff3aa8'; x.fillRect(26, 206, Math.round((268 * row) / RH), 10);
      text(x, 'PRESS START TO SKIP', RW / 2, 6, (S.t >> 5) % 2 ? '#ffffff' : '#808080');
      return;
    }
    if (p === 'convert') {
      // the dithered version wipes across the full-colour render
      x.drawImage(S.raw, 0, 0);
      const w = Math.round(Math.min(1, S.phaseT / 36) * RW);
      x.drawImage(sceneFor(l), 0, 0, l === '8' ? w / 2 : w, l === '8' ? RH / 2 : RH, 0, 0, w, RH);
      x.fillStyle = '#ffffff'; x.fillRect(w, 0, 1, RH);
      text(x, l === '8' ? 'DITHERING TO 16 COLOURS' : 'DITHERING TO 512 COLOURS', RW / 2, 112, '#ffd060');
      return;
    }
    if (S.shake > 0) x.setTransform(1, 0, 0, 1, Math.round((Math.random() - 0.5) * S.shake), Math.round((Math.random() - 0.5) * S.shake));
    drawScene(x, l);
    if (l === '16') flare(x);
    if (p === 'intro') {
      const k = Math.min(1, S.phaseT / 40);
      if (reduce) drawLogo(x, l, 8);
      else drawLogo(x, l, 8, 1 + (1 - ease(k)) * 3.2, Math.min(1, k * 2));
      if (S.phaseT > 48) text(x, 'SUBMARINE COMBAT'.slice(0, Math.floor((S.phaseT - 48) / 3)), RW / 2, 116, '#ffd060');
    } else {
      const bob = reduce ? 0 : Math.round(Math.sin(S.t * 0.04) * 2);
      const zoom = p === 'leave' ? 1 + Math.pow(S.phaseT / 40, 2) * 2.5 : 1;
      drawLogo(x, l, 8 + bob, zoom);
      text(x, 'SUBMARINE COMBAT', RW / 2, 116, '#ffd060');
      const showScores = p === 'attract' && S.t % 960 > 640;
      if (showScores) scores(x);
      else {
        rasterBars(x, l);
        const blink = p === 'leave' ? (S.t >> 1) % 2 : (S.t >> 5) % 2 === 0;
        if (blink || reduce) text(x, matchMedia('(pointer: coarse)').matches ? 'TAP TO START' : 'PRESS START', RW / 2, 196, '#ffffff');
        if (net.status === 'online' && net.peers.length) text(x, `${net.peers.length} ONLINE NOW`, RW / 2, 140, '#40e0ff');
      }
      scroller(x);
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    const fl = p === 'leave' ? S.phaseT / 40 : S.flash / 12;
    if (fl > 0) { x.fillStyle = `rgba(255,255,255,${Math.min(1, fl).toFixed(2)})`; x.fillRect(0, 0, RW, RH); }
  }

  return (
    <section class="start" aria-label="Start screen" onClick={press}>
      <canvas ref={cv} width={RW} height={RH} aria-hidden="true" />
      <button class="start-btn" onClick={(e) => { e.stopPropagation(); press(); }}>Press start</button>
      <p class="sr" role="status" ref={status} />
    </section>
  );
}
