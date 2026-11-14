// Picks the renderer for the look this player chose. The game itself doesn't change: both looks draw
// the same state, so two players in one online match can each use a different look.
import * as r8 from './render8.js';
import * as r16 from './render16.js';
import { stepVfx } from './vfx.js';

let canvas = null;
let look = '16';

function apply() {
  const big = look === '16';
  canvas.width = big ? 320 : 160;
  canvas.height = big ? 240 : 120;
  (big ? r16 : r8).attach(canvas);
}
export function attach(c) { canvas = c; apply(); }
export function setLookRenderer(l) { look = l === '8' ? '8' : '16'; if (canvas) apply(); }
/** Per-tick animation. The 8-bit look has no extra animation, but effects still need to expire. */
export function animate() { if (look === '16') r16.animate(); else stepVfx(); }
export function draw() { (look === '16' ? r16 : r8).draw(); }
