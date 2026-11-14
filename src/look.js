// 8-bit or 16-bit, chosen per player and remembered in this browser.
import { createSignal } from 'solid-js';
import { setLookRenderer } from './game/render.js';

function saved() {
  try { return localStorage.getItem('depthrunner.look') === '8' ? '8' : '16'; } catch { return '16'; }
}
const [look, setLookSignal] = createSignal(saved());
export { look };

function applyLook(l) {
  document.documentElement.dataset.look = l;
  setLookRenderer(l);
}
applyLook(look());

export function setLook(l) {
  l = l === '8' ? '8' : '16';
  setLookSignal(l);
  applyLook(l);
  try { localStorage.setItem('depthrunner.look', l); } catch { /* storage blocked */ }
}
export const toggleLook = () => setLook(look() === '8' ? '16' : '8');
