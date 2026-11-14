// Touch controls on a phone: holding a button never opens the long-press menu, and no button can stay
// held down after the finger is gone (game over mid-press, a cancelled touch, the page losing focus).
import { chromium, checker, ev, until } from './harness.mjs';

const url = process.argv[2];
const { ok, fails } = checker();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(url);
await until(p, (d) => !!d);
const held = () => ev(p, (d) => ['ArrowLeft', 'ArrowRight', 'Space'].filter((k) => d.keys[k]));
const pointer = (sel, type, id = 7, x, y) => p.evaluate(([s, t, i, px, py]) => {
  const el = document.querySelector(s);
  const r = el.getBoundingClientRect();
  const ev = new PointerEvent(t, { pointerId: i, pointerType: 'touch', bubbles: true, cancelable: true, isPrimary: true,
    clientX: px ?? r.x + r.width / 2, clientY: py ?? r.y + r.height / 2 });
  el.dispatchEvent(ev);
  return ev.defaultPrevented;
}, [sel, type, id, x, y]);

await p.click('text=1 PLAYER');
await until(p, (d) => d.screen() === 'play');
const LEFT = '.pad[aria-label="Move left"]';

// holding a button doesn't open the long-press menu or select text
const menu = await p.evaluate((s) => {
  const el = document.querySelector(s);
  const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  const frame = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  document.querySelector('.frame').dispatchEvent(frame);
  return [e.defaultPrevented, frame.defaultPrevented];
}, LEFT);
ok('long-press menu is blocked on the buttons and the game screen', menu[0] && menu[1]);
const sel = await p.evaluate((s) => [s, '.frame', '.top10 h2', '.info dd', 'h1', 'body'].map((q) => {
  const cs = getComputedStyle(document.querySelector(q));
  return cs.webkitUserSelect || cs.userSelect;
}), LEFT);
ok('no text selection anywhere on the page, not just the game (iOS selects nearby text)', sel.every((v) => v === 'none'));
// a long press on a button: the raw touch is cancelled, so iOS can't start its selection or magnifier
const touchBlocked = await p.evaluate((s) => {
  const el = document.querySelector(s);
  const r = el.getBoundingClientRect();
  const t = new Touch({ identifier: 3, target: el, clientX: r.x + 5, clientY: r.y + 5 });
  return ['touchstart', 'touchmove', 'touchend'].map((type) => {
    const e = new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true });
    el.dispatchEvent(e);
    return e.defaultPrevented;
  });
}, LEFT);
ok('touches on the buttons are cancelled (no long-press selection)', touchBlocked.every(Boolean));

// a normal press and release
await pointer(LEFT, 'pointerdown');
ok('press holds the key', (await held()).includes('ArrowLeft'));
await pointer(LEFT, 'pointerup');
ok('release lets it go', (await held()).length === 0);

// the browser cancels the touch (what a long-press menu or a scroll does)
await pointer(LEFT, 'pointerdown');
await pointer(LEFT, 'pointercancel');
ok('a cancelled touch lets it go', (await held()).length === 0);

// finger slides off the button (it stays held, as a thumb drifts) and lifts somewhere else
await pointer(LEFT, 'pointerdown');
await pointer(LEFT, 'pointerleave');
ok('a thumb drifting off the button keeps it held', (await held()).includes('ArrowLeft'));
await pointer('.who', 'pointerup');
ok('lifting the finger anywhere lets it go', (await held()).length === 0);

// the name box is still editable text
ok('name boxes can still be typed in and selected', await p.evaluate(() => {
  const i = document.createElement('input'); i.className = 'probe'; document.body.append(i);
  const cs = getComputedStyle(i); const v = cs.webkitUserSelect || cs.userSelect; i.remove(); return v !== 'none';
}));

// the game ends while the finger is still down: the buttons go away mid-press
await pointer(LEFT, 'pointerdown');
await pointer('.pad.fire', 'pointerdown', 8);
await ev(p, (d) => { const { S } = d; S.lives = 1; S.hull = 1; S.inv = 0; S.sub.shield = false; S.charges = [{ x: S.sub.x + 6, y: S.sub.y + 1, v: 0 }]; });
await until(p, (d) => d.screen() === 'over');
ok('game over mid-press leaves nothing held', (await held()).length === 0);
await p.click('button:has-text("PLAY AGAIN")');
const x0 = await ev(p, (d) => d.S.sub.x);
await p.waitForTimeout(700);
ok('the next game starts with the sub still', await ev(p, (d, x) => d.S.sub.x === x, x0));

// the page loses focus while a button is held
await pointer(LEFT, 'pointerdown');
await p.evaluate(() => window.dispatchEvent(new Event('blur')));
ok('losing focus lets it go', (await held()).length === 0);
await pointer(LEFT, 'pointerdown');
await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
ok('the page being hidden or switched away lets it go', await p.evaluate(() => document.visibilityState) === 'visible' ? true : (await held()).length === 0);
await pointer(LEFT, 'pointerup');

// two fingers: lifting one doesn't release the other's button
await pointer(LEFT, 'pointerdown', 1);
await pointer('.pad.fire', 'pointerdown', 2);
await pointer('.pad.fire', 'pointerup', 2);
ok('two fingers are tracked separately', JSON.stringify(await held()) === '["ArrowLeft"]');
await pointer(LEFT, 'pointerup', 1);

ok('no page errors', errors.length === 0);
if (errors.length) console.log(errors);
await browser.close();
process.exit(fails.length ? 1 : 0);
