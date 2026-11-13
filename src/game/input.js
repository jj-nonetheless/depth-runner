// Keyboard and touch buttons feed one key map; `controls(role)` reads it for whichever side you play.
export const keys = {};

export function press(code, down) { keys[code] = down; }
export function releaseAll() { for (const k in keys) keys[k] = false; }

export function controls(role) {
  const l = !!(keys.ArrowLeft || keys.KeyA);
  const r = !!(keys.ArrowRight || keys.KeyD);
  const a = role === 'sub'
    ? !!(keys.Space || keys.ArrowUp || keys.KeyW)
    : !!(keys.Space || keys.KeyS || keys.ArrowDown);
  return { l, r, a };
}

export const idle = { l: false, r: false, a: false };
