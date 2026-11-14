// 8-bit and 16-bit looks: each player picks their own, it sticks, and switching never disturbs a game.
import { readFileSync } from 'node:fs';
import { chromium, checker, ev, until } from './harness.mjs';

const url = process.argv[2];
const { ok, fails } = checker();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
await ctx.addInitScript(readFileSync(new URL('./mockroom.js', import.meta.url), 'utf8'));
const errors = [];
const open = async () => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(url);
  await until(p, (d) => d && d.net.status === 'online');
  return p;
};
const lookOf = (p) => p.evaluate(() => [document.documentElement.dataset.look, document.querySelector('canvas').width]);
const allEffects = (p) => ev(p, (d) => {
  const { FX } = d;
  FX.fire(60, 100); FX.twin(70, 100); FX.drop(40, 22); FX.chg(50, 60); FX.sink(30, 20); FX.bsink(100, 20);
  FX.guard(80, 100); FX.subhit(80, 104); FX.bed(90, 111); FX.pu(70, 90); FX.lvl();
});

const A = await open();
let [l, w] = await lookOf(A);
ok('16-bit by default, drawn at 320x240', l === '16' && w === 320);
await A.click('.look button:has-text("8-BIT")');
[l, w] = await lookOf(A);
ok('8-BIT switch: C64 look at 160x120', l === '8' && w === 160 && await A.isVisible('text=READY.'));

// a full 1 player game with every effect, in 8-bit
await A.keyboard.press('Digit1');
await allEffects(A);
await A.keyboard.down('Space'); await A.waitForTimeout(400); await A.keyboard.up('Space');
ok('8-bit plays with every effect', await ev(A, (d) => d.screen() === 'play'));

// switch mid-game with G: same game carries on
const before = await ev(A, (d) => ({ gid: d.S.gid, score: d.S.score, lives: d.S.lives }));
await A.keyboard.press('KeyG');
[l, w] = await lookOf(A);
const after = await ev(A, (d) => ({ gid: d.S.gid, lives: d.S.lives, phase: d.S.phase }));
ok('G switches to 16-bit mid-game without restarting it', l === '16' && w === 320 && after.gid === before.gid && after.lives === before.lives && after.phase === 'play');
await allEffects(A);
await A.waitForTimeout(800);
ok('16-bit plays with every effect', await ev(A, (d) => d.screen() === 'play'));
await A.keyboard.press('KeyG');

// the choice is remembered
await A.reload();
await until(A, (d) => d && d.net.status === 'online');
[l, w] = await lookOf(A);
ok('choice remembered after reload', l === '8' && w === 160);

// typing a name never flips the look
await A.click('text=2 PLAYERS ONLINE');
await A.fill('#nick', 'gregg');
[l] = await lookOf(A);
ok('typing G in a name box does not switch', l === '8');

// online: an 8-bit player against a 16-bit player
const B = await open();
await B.click('.look button:has-text("16-BIT")');
await B.click('text=2 PLAYERS ONLINE');
await B.fill('#nick', 'hiro'); await B.press('#nick', 'Enter');
await A.press('#nick', 'Enter');
await A.locator('.players li', { hasText: 'HIRO' }).locator('button').click();
await B.locator('.invite').waitFor();
await B.click('.invite button:has-text("ACCEPT")');
await until(A, (d) => d.screen() === 'roles'); await until(B, (d) => d.screen() === 'roles');
await A.click('button.side.sub'); await B.click('button.side.ship');
await A.click('button:has-text("READY")'); await B.click('button:has-text("READY")');
await until(A, (d) => d.screen() === 'play'); await until(B, (d) => d.screen() === 'play');
await ev(A, (d) => { d.S.cool = 0; });
await A.bringToFront(); await A.keyboard.down('Space'); await until(B, (d) => d.S.torps.length > 0); await A.keyboard.up('Space');
const [la] = await lookOf(A), [lb] = await lookOf(B);
ok('each player keeps their own look in one online match', la === '8' && lb === '16');
await A.screenshot({ path: 'test-results/look-8.png' }).catch(() => {});
await B.screenshot({ path: 'test-results/look-16.png' }).catch(() => {});

ok('no page errors', errors.length === 0);
if (errors.length) console.log(errors);
await browser.close();
process.exit(fails.length ? 1 : 0);
