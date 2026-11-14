// On-screen buttons for touch screens (hidden on devices with a mouse).
// Each button follows the finger that pressed it: the button stays held if the thumb drifts off it, and
// lets go when that finger lifts anywhere, the touch is cancelled, or the buttons go away mid-press
// (game over), so a key can never stay stuck down.
import { onCleanup, onMount } from 'solid-js';
import { press } from '../game/input.js';
import { S } from '../game/engine.js';

const noMenu = (e) => e.preventDefault();

function Pad(props) {
  let el;
  let finger = null;
  const release = (e) => {
    if (finger === null || (e && e.pointerId !== finger)) return;
    finger = null;
    press(props.code, false);
    el?.classList.remove('on');
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', release);
  };
  const down = (e) => {
    e.preventDefault();
    if (finger !== null) return;
    finger = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch { /* not supported: the window listeners cover it */ }
    press(props.code, true);
    el.classList.add('on');
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  };
  onCleanup(() => { if (finger !== null) release({ pointerId: finger }); });
  return (
    <button ref={el} class={'pad ' + (props.class || '')} aria-label={props.label}
      onPointerDown={down} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onContextMenu={noMenu}>
      {props.children}
    </button>
  );
}

export default function Pads() {
  const ship = S.mode === 2 && S.myRole === 'ship';
  let row;
  // iOS starts its long-press text selection and magnifier from the raw touch events, before any
  // pointer event can stop it, so cancel those here. The buttons work from pointer events alone.
  onMount(() => {
    for (const t of ['touchstart', 'touchmove', 'touchend']) row.addEventListener(t, noMenu, { passive: false });
  });
  return (
    <div ref={row} class={'pads' + (ship ? ' ship' : '')} aria-label="Touch controls" onContextMenu={noMenu}>
      <div class="grp">
        <Pad code="ArrowLeft" label="Move left">&larr;</Pad>
        <Pad code="ArrowRight" label="Move right">&rarr;</Pad>
      </div>
      <span class="who">{ship ? 'SHIP' : 'SUB'}</span>
      <Pad code="Space" class="fire" label={ship ? 'Drop a depth charge' : 'Fire a torpedo'}>{ship ? 'DROP' : 'FIRE'}</Pad>
    </div>
  );
}
