// 16-bit sprite art. Each sprite is a character map; each character is a palette colour ('.' is
// transparent). Sprites are rasterised once into small canvases (and mirrored copies) and drawn
// with drawImage. Screen pixels are half a game unit: the 160x120 game is drawn at 320x240.

export const K = '#0d1024'; // outline

const SUB_PAL = {
  k: K, H: '#eef7a8', G: '#b8c76f', D: '#6f8a3a', E: '#3f5520',
  w: '#3fa8d8', W: '#e8fbff', r: '#d24a3a', m: '#7d8896', M: '#d8dee6',
};
// facing right (nose to the right); rows 7-15 are the hull, which lines up with the 12x5 hit box
const SUB = [
  '.............kkk..............',
  '.............kMk..............',
  '.............kmk..............',
  '..........kkkkmkkkk...........',
  '.........kHHHHHHHGGk..........',
  '.........kHGGwWGGGDk..........',
  '....kkkkkkGGGGGGGGDDkkkkkkk...',
  '..kkHHHHHHHHHHHHHHHHHHHHHHHkk.',
  '.kHHGGGGGGGGGGGGGGGGGGGGGGGGHk',
  'kHGGwWGGGwWGGGwWGGGGGGGGGGGGGk',
  'kGGGwwGGGwwGGGwwGGGGGGGGGGGGDk',
  'kDGGGGGGGGGGGGGGGGGGGGGGGGGGDk',
  'krrrrrrrrrrrrrrrrrrrrrrrrrrrk.',
  '.kDDDDDDDDDDDDDDDDDDDDDDDDDDk.',
  '..kkEEEEEEEEEEEEEEEEEEEEEEkk..',
  '....kkkkkkkkkkkkkkkkkkkkkk....',
];
// propeller at the stern, two frames
const PROP = [
  ['.M', 'km', '.m', 'km', '.M'],
  ['..', '.m', 'kM', '.m', '..'],
];

const SHIP_PAL = {
  k: K, L: '#eef1f6', l: '#b8c0cc', d: '#7a8494', s: '#4a5262',
  R: '#a8352c', Y: '#ffd76a', b: '#2c313c', f: '#d0503e',
};
// grey freighter (computer ships in 1 player), bow to the right
const SHIP = [
  '......................k.........',
  '......................kl........',
  '.........kkkk.........kl........',
  '.........kbbk.........kl........',
  '.........kffk.....kkkkkkkk......',
  '.........kbbk....kLLLLLLLLk.....',
  '......kkkkkkkkkkkkLYlYlYlLk.....',
  '.....kLLLLLLLLLLLLLlllllllkk....',
  'kkkkkLllllllllllllllllllllllkkkk',
  'kLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLk',
  'klllllllllllllllllllllllllllldk.',
  '.kdddddddddddddddddddddddddddk..',
  '..kRRRRRRRRRRRRRRRRRRRRRRRRRk...',
  '...kkkkkkkkkkkkkkkkkkkkkkkkk....',
];

const BOAT_PAL = {
  k: K, L: '#ffd8cc', l: '#e08070', d: '#a84a3a', s: '#5a2620',
  g: '#4a4f5a', G: '#a2aab6', Y: '#ffe08a', r: '#ff5a4a',
};
// the player's destroyer, bow to the right
const BOAT = [
  '...............kr...............',
  '...............kG...............',
  '.............kkkkk..............',
  '............kLLLLLk.............',
  '............kYlYlYk.......kkk...',
  '.....kkk....klllllk.....kkGGk...',
  '....kGGgkkkkklllllkkkkkkkgggGkkkk',
  '..kkkgglllllllllllllllllllgggk...',
  '.kLLLLLLLLLLLLLLLLLLLLLLLLLLLLk..',
  'kLlllllllllllllllllllllllllllllk.',
  'kllllllllllllllllllllllllllllldk.',
  '.kddddddddddddddddddddddddddddk..',
  '..kssssssssssssssssssssssssssk...',
  '...kkkkkkkkkkkkkkkkkkkkkkkkkk....',
];

const CHG_PAL = { k: K, M: '#9aa0ac', m: '#565b66', d: '#2c2f38', y: '#f2c84a' };
const CHARGE = [
  '..kkkk..',
  '.kMmmMk.',
  '.kmddmk.',
  '.kyyyyk.',
  '.kmddmk.',
  '.kMmmMk.',
  '..kkkk..',
];

const TORP_PAL = { k: K, W: '#ffffff', M: '#dfe6ee', m: '#9aa6b4', r: '#e84a3a' };
const TORPEDO = [
  '.WW.',
  'WMMW',
  'MmmM',
  'MmmM',
  'rrrr',
  'MmmM',
  'MmmM',
  'kmmk',
  'k..k',
];

const LIFE_PAL = { k: K, G: '#b8c76f', H: '#eef7a8', D: '#6f8a3a' };
const LIFE_ICON = [
  '....kk....',
  '...kGGk...',
  '.kkkGGkkk.',
  'kHHHHHHHHk',
  'kGGGGGGGDk',
  '.kkkkkkkk.',
];
const SHIP_LIFE_PAL = { k: K, L: '#ffd8cc', l: '#e08070', d: '#a84a3a' };
const SHIP_LIFE_ICON = [
  '....kk....',
  '...kLLk...',
  'kkkkllkkkk',
  'kLLLLLLLLk',
  '.kllllldk.',
  '..kkkkkk..',
];

function raster(map, pal) {
  const w = Math.max(...map.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = map.length;
  const x = c.getContext('2d');
  map.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== '.' && pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1); }
  }));
  return c;
}
function mirror(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const x = c.getContext('2d');
  x.translate(src.width, 0);
  x.scale(-1, 1);
  x.drawImage(src, 0, 0);
  return c;
}
function pair(map, pal) { const r = raster(map, pal); return { r, l: mirror(r) }; }

/** All sprites, built on first use (needs a DOM). `.r` faces right, `.l` faces left. */
export const SPR = {};
export function buildArt() {
  if (SPR.sub) return;
  SPR.sub = pair(SUB, SUB_PAL);
  SPR.prop = PROP.map((f) => pair(f, SUB_PAL));
  SPR.ship = pair(SHIP, SHIP_PAL);
  SPR.boat = pair(BOAT, BOAT_PAL);
  SPR.charge = raster(CHARGE, CHG_PAL);
  SPR.torp = raster(TORPEDO, TORP_PAL);
  SPR.life = raster(LIFE_ICON, LIFE_PAL);
  SPR.shipLife = raster(SHIP_LIFE_ICON, SHIP_LIFE_PAL);
}

// ---------- pixel circles (explosions, rings), cached by size and colour
const discs = new Map();
/** A filled pixel disc, with a dithered rim so edges read as 16-bit shading rather than smooth. */
export function disc(r, color) {
  r = Math.max(1, Math.round(r));
  const key = r + color;
  if (discs.has(key)) return discs.get(key);
  const d = r * 2 + 1;
  const c = document.createElement('canvas');
  c.width = c.height = d;
  const x = c.getContext('2d');
  x.fillStyle = color;
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < d; i++) {
      const dist = Math.hypot(i - r, j - r);
      if (dist <= r - 1 || (dist <= r + 0.3 && (i + j) % 2 === 0)) x.fillRect(i, j, 1, 1);
    }
  }
  discs.set(key, c);
  return c;
}
const rings = new Map();
export function ring(r, color) {
  r = Math.max(2, Math.round(r));
  const key = r + color;
  if (rings.has(key)) return rings.get(key);
  const d = r * 2 + 1;
  const c = document.createElement('canvas');
  c.width = c.height = d;
  const x = c.getContext('2d');
  x.fillStyle = color;
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < d; i++) {
      const dist = Math.hypot(i - r, j - r);
      if (dist > r - 1.2 && dist <= r + 0.2) x.fillRect(i, j, 1, 1);
    }
  }
  rings.set(key, c);
  return c;
}
