// Draws the playfield and the in-game HUD. Menus and the lobby are Solid components on top.
import { W, H, SURF, BED, P, SUB, SHIP, BOAT, GLYPH, PU } from './constants.js';
import { S } from './engine.js';

let ctx;
let tick = 0;
export function attach(canvas) { ctx = canvas.getContext('2d'); }

function spr(a, x, y, c, c2) {
  for (let r = 0; r < a.length; r++) {
    for (let i = 0; i < a[r].length; i++) {
      if (a[r][i] === '#') { ctx.fillStyle = r === a.length - 1 && c2 ? c2 : c; ctx.fillRect((x + i) | 0, (y + r) | 0, 1, 1); }
    }
  }
}
function glyph(g, x, y, c) {
  ctx.fillStyle = c;
  const a = GLYPH[g];
  for (let r = 0; r < 5; r++) for (let i = 0; i < 3; i++) if (a[r][i] === '#') ctx.fillRect(x + i, y + r, 1, 1);
}
function capsule(k, x, y, flash) {
  const p = PU[k];
  x |= 0; y |= 0;
  ctx.fillStyle = flash ? '#FFFFFF' : p.c;
  ctx.fillRect(x + 1, y, 5, 7);
  ctx.fillRect(x, y + 1, 7, 5);
  ctx.fillStyle = p.c;
  ctx.fillRect(x + 1, y + 1, 5, 5);
  glyph(p.g, x + 2, y + 1, P.dark);
}
function icon(k, x, y, left) {
  if (left !== undefined && left < 120 && (tick >> 3) % 2) return; // blink while running out
  ctx.fillStyle = PU[k].c;
  ctx.fillRect(x, y, 5, 7);
  glyph(PU[k].g, x + 1, y + 1, P.dark);
}
function txt(s, x, y, c = P.txt, a = 'left') {
  ctx.fillStyle = c;
  ctx.font = '8px monospace';
  ctx.textAlign = a;
  ctx.fillText(s, x, y);
}
function ring(x, y, w, h) {
  if ((tick >> 2) % 3 === 0) return;
  ctx.fillStyle = P.def;
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillRect(x, y + 1, 1, h - 2);
  ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
}

function drawHud() {
  const { sub, boat } = S;
  if (S.mode === 1) {
    txt('SCORE ' + S.score, 2, 8);
    txt('LV ' + S.level, W / 2, 8, P.txt, 'center');
    txt('SUBS ' + S.lives, W - 2, 8, P.txt, 'right');
    txt('HI ' + S.hi, W / 2, 17, P.boom, 'center');
  } else {
    txt('SUB ' + S.lives, 2, 8, P.sub);
    txt('SHIP ' + S.boatLives, W - 2, 8, P.boat, 'right');
    txt(S.opp === 'remote' ? 'ONLINE' : 'VS CPU', W / 2, 8, P.txt, 'center');
    txt('YOU: ' + S.myRole.toUpperCase(), W / 2, 17, S.myRole === 'sub' ? P.sub : P.boat, 'center');
  }
  if (S.phase !== 'play') return;
  // the sub's active power-ups sit on the seabed strip, the ship's under its life count
  let x = 2;
  if (sub.shield) { icon('shield', x, BED + 1); x += 7; }
  if (sub.twin > 0) { icon('twin', x, BED + 1, sub.twin); x += 7; }
  if (sub.rapid > 0) { icon('rapid', x, BED + 1, sub.rapid); x += 7; }
  if (S.mode === 2) {
    x = W - 7;
    if (boat.armor) { icon('armor', x, 11); x -= 7; }
    if (boat.cluster > 0) { icon('cluster', x, 11, boat.cluster); x -= 7; }
    if (boat.rapid > 0) { icon('reload', x, 11, boat.rapid); x -= 7; }
  }
  if (S.msg.t > 0) txt(S.msg.text, W / 2, 36, S.msg.c, 'center');
  if (S.paused) {
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillRect(16, 50, 128, 20);
    txt('PAUSED', W / 2, 63, P.txt, 'center');
  }
}

export function draw() {
  tick++;
  ctx.fillStyle = P.sky;
  ctx.fillRect(0, 0, W, SURF);
  const g = ctx.createLinearGradient(0, SURF, 0, BED);
  g.addColorStop(0, P.sea);
  g.addColorStop(1, P.deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, SURF, W, BED - SURF);
  ctx.fillStyle = P.dim;
  for (let x = 0; x < W; x += 4) ctx.fillRect(x + (((tick / 12) | 0) % 4), SURF, 2, 1);
  ctx.fillStyle = P.bed;
  ctx.fillRect(0, BED, W, H - BED);
  if (!S.sub) return; // nothing to draw before the first game

  const live = S.phase === 'play' || S.phase === 'over';
  const { sub, boat } = S;
  if (live) {
    for (const it of S.items) {
      if (it.life < 90 && (tick >> 2) % 2) continue;
      capsule(it.kind, it.x, it.y + (it.owner === 'ship' ? (tick >> 4) % 2 : 0), (tick >> 4) % 2 === 0);
    }
  }
  for (const s of S.ships) spr(SHIP, s.x, s.y, P.ship, P.shipd);
  const boatShown = S.mode === 2 && live && boat.down === 0 && !(S.phase === 'over' && S.winner === 'SUB');
  if (boatShown && (boat.inv === 0 || (boat.inv >> 2) % 2)) {
    spr(BOAT, boat.x, boat.y, P.boat, P.boatd);
    if (boat.armor) ring((boat.x - 2) | 0, boat.y - 2, 20, 9);
  }
  ctx.fillStyle = P.chg;
  for (const c of S.charges) { ctx.fillRect(c.x - 1, c.y, 3, 2); ctx.fillRect(c.x, c.y - 1, 1, 4); }
  ctx.fillStyle = P.tor;
  for (const t of S.torps) ctx.fillRect(t.x, t.y, 2, 4);
  const subShown = !(S.phase === 'over' && S.lives <= 0) && (S.inv === 0 || (S.inv >> 2) % 2 || !live);
  if (subShown) {
    spr(SUB, sub.x, sub.y, P.sub, P.subd);
    if (sub.shield && S.phase === 'play') ring((sub.x - 2) | 0, sub.y - 2, 16, 8);
  }
  for (const p of S.parts) { ctx.fillStyle = p.c; ctx.fillRect(p.x | 0, p.y | 0, 1, 1); }
  if (live) drawHud();
}
