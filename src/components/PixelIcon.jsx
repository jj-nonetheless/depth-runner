// A power-up drawn the way the game draws it: a rounded capsule in its colour with the icon in dark pixels.
import { For } from 'solid-js';
import { ICON, PU, P } from '../game/constants.js';

export default function PixelIcon(props) {
  const cells = () => ICON[props.kind].flatMap((row, y) => [...row].map((ch, x) => (ch === '#' ? [x, y] : null)).filter(Boolean));
  return (
    <svg class="picon" viewBox="0 0 9 9" width={props.size || 27} height={props.size || 27} role="img" aria-label={PU[props.kind].name.toLowerCase()} shape-rendering="crispEdges">
      <path d="M1 0h7v1h1v7h-1v1h-7v-1h-1v-7h1z" fill={PU[props.kind].c} />
      <For each={cells()}>{([x, y]) => <rect x={x + 1} y={y + 1} width="1" height="1" fill={P.dark} />}</For>
    </svg>
  );
}
