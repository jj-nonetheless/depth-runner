// Visual-only effects (explosions, splashes, sinking wrecks, screen shake). They never change the
// game; the engine and the online guest both trigger them through the same events, and the
// renderer advances and draws them. Positions are in game units (160x120).
export const V = { list: [], shake: 0, flash: 0, flashColor: '#ffffff' };

const LIFE = { boom: 40, ring: 26, splash: 34, wreck: 200, sand: 30, sparkle: 30, muzzle: 10, guard: 24 };

export function vfx(kind, x, y, extra = {}) {
  // a delayed effect waits `delay` ticks before it starts, so it lives that much longer
  V.list.push({ kind, x, y, t: 0, ...extra, life: (LIFE[kind] ?? 30) + (extra.delay || 0) });
  if (V.list.length > 80) V.list.shift();
}
export function shake(amount) { V.shake = Math.max(V.shake, amount); }
export function flash(color = '#ffffff', amount = 8) { V.flash = amount; V.flashColor = color; }

/** Advance one 1/60 s tick. */
export function stepVfx() {
  for (const e of V.list) e.t++;
  V.list = V.list.filter((e) => e.t < e.life);
  if (V.shake > 0) V.shake = Math.max(0, V.shake - 0.4);
  if (V.flash > 0) V.flash--;
}
export function clearVfx() { V.list = []; V.shake = 0; V.flash = 0; }
