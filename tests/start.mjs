// The pre-rendered start screen: traced on the first visit, loaded from the saved render after that,
// skippable, and it hands over to the title menu.
import { chromium, checker, ev, until } from './harness.mjs';

const url = process.argv[2] + '&start';
const { ok, fails } = checker();
const browser = await chromium.launch();
const errors = [];
const open = async (ctx) => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(url);
  await until(p, (d) => !!d);
  return p;
};
const phase = (p) => ev(p, (d) => d.startPhase());
const colours = (p) => p.evaluate(() => {
  const c = document.querySelector('.start canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const s = new Set();
  for (let i = 0; i < d.length; i += 16) s.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
  return s.size;
});

// ---- first visit: traced on screen
const ctx = await browser.newContext({ viewport: { width: 800, height: 900 } });
const A = await open(ctx);
await until(A, (d) => d.startPhase() === 'render', null, 10000);
ok('first visit traces the scene on screen', true);
await A.locator('.sr', { hasText: 'Rendering the start screen' }).waitFor({ state: 'attached' });
ok('progress is announced', true);
await until(A, (d) => d.startPhase() === 'attract', null, 30000);
ok('then the logo comes in and attract mode runs', await ev(A, (d) => d.screen() === 'start'));
ok('the pre-render is rich (many colours on screen)', (await colours(A)) > 60);
await A.keyboard.press('Enter');
await until(A, (d) => d.screen() === 'title', null, 5000);
ok('press start goes to the title menu', await A.isVisible('text=2 PLAYERS ONLINE'));
// regression: the start screen's loop must stop once it has gone, or it keeps sending you back to the title
await A.click('button:has-text("1 PLAYER")');
await A.waitForTimeout(1000);
ok('choosing a mode after the start screen sticks', await ev(A, (d) => d.screen() === 'play'));
await A.keyboard.press('Escape');
await A.keyboard.press('Digit3');
await A.waitForTimeout(800);
ok('the keyboard menu works after it too', await ev(A, (d) => d.screen() === 'roles'));

// ---- next visit: loaded, not traced
const B = await open(ctx);
await until(B, (d) => d.startPhase() !== 'loading', null, 10000);
ok('a later visit uses the saved render', ['intro', 'attract'].includes(await phase(B)));
await until(B, (d) => d.startPhase() === 'attract', null, 10000);
await B.click('.start');
await until(B, (d) => d.screen() === 'title', null, 5000);
ok('clicking the screen starts too', true);

// ---- skipping while it traces
const fresh = await browser.newContext({ viewport: { width: 800, height: 900 } });
const C = await open(fresh);
await until(C, (d) => d.startPhase() === 'render', null, 10000);
await C.keyboard.press('Space');
await until(C, (d) => d.screen() === 'title', null, 3000);
ok('start during the trace skips straight to the menu', true);
await C.click('button:has-text("2 PLAYERS ONLINE")');
await C.waitForTimeout(1000);
ok('choosing a mode after skipping sticks', await ev(C, (d) => d.screen() === 'lobby'));

// ---- 8-bit look and reduced motion
const eight = await browser.newContext({ viewport: { width: 800, height: 900 }, reducedMotion: 'reduce' });
await eight.addInitScript(() => localStorage.setItem('depthrunner.look', '8'));
const D = await open(eight);
await until(D, (d) => d.startPhase() === 'attract', null, 30000);
ok('8-bit look with reduced motion reaches attract mode', await D.evaluate(() => document.documentElement.dataset.look) === '8');
await D.locator('.start canvas').screenshot({ path: 'test-results/start-8bit.png' }).catch(() => {});
await A.goto('about:blank');

ok('no page errors', errors.length === 0);
if (errors.length) console.log(errors);
await browser.close();
process.exit(fails.length ? 1 : 0);
