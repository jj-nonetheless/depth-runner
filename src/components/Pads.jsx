// On-screen buttons for touch screens (hidden on devices with a mouse).
import { press } from '../game/input.js';
import { S } from '../game/engine.js';

function Pad(props) {
  const down = (e) => { e.preventDefault(); press(props.code, true); e.currentTarget.classList.add('on'); };
  const up = (e) => { press(props.code, false); e.currentTarget.classList.remove('on'); };
  return (
    <button class={'pad ' + (props.class || '')} aria-label={props.label}
      onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}>
      {props.children}
    </button>
  );
}

export default function Pads() {
  const ship = S.mode === 2 && S.myRole === 'ship';
  return (
    <div class={'pads' + (ship ? ' ship' : '')} aria-label="Touch controls">
      <div class="grp">
        <Pad code="ArrowLeft" label="Move left">&larr;</Pad>
        <Pad code="ArrowRight" label="Move right">&rarr;</Pad>
      </div>
      <span class="who">{ship ? 'SHIP' : 'SUB'}</span>
      <Pad code="Space" class="fire" label={ship ? 'Drop a depth charge' : 'Fire a torpedo'}>{ship ? 'DROP' : 'FIRE'}</Pad>
    </div>
  );
}
