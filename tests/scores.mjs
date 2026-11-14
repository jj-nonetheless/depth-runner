// The Top 10 across tabs sharing a stand-in database (tests/mockdb.js), plus the power-up icons.
import { readFileSync } from 'node:fs';
import { chromium, checker, ev, until } from './harness.mjs';

const url = process.argv[2];
const { ok, fails } = checker();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 900, height: 1300 } });
await ctx.addInitScript(readFileSync(new URL('./mockdb.js', import.meta.url), 'utf8'));
const errors = [];
const open = async (hash = '') => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('dialog', (d) => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  await p.goto(url + hash);
  await until(p, (d) => d && d.board.status === 'online');
  return p;
};
// play a 1 player game that ends with this score
async function finishWith(p, score) {
  await p.keyboard.press('Escape');
  await p.keyboard.press('Digit1');
  await until(p, (d) => d.screen() === 'play');
  await ev(p, (d, n) => { const { S } = d; S.score = n; S.lives = 1; S.hull = 1; S.inv = 0; S.sub.shield = false; S.charges = [{ x: S.sub.x + 6, y: S.sub.y + 1, v: 0 }]; }, score);
  await until(p, (d) => d.screen() === 'over');
}
const topRows = (p) => p.locator('.top10 .scores li').allInnerTexts();

const A = await open();
ok('empty board says how to get on it', (await topRows(A))[0].includes('NO SCORES YET'));

// ---- first score: offered a place, saved under a typed name
await finishWith(A, 500);
ok('results offer a Top 10 place', await A.isVisible('text=NEW TOP 10 SCORE · #1'));
await A.fill('#score-name', 'ace');
await A.press('#score-name', 'Enter');
await A.locator('text=SAVED · #1 ON THE TOP 10').waitFor();
await until(A, (d) => d.board.shared.length === 1);
const rowA = (await topRows(A))[0];
ok('saved score is on the board, marked as yours', rowA.includes('ACE') && rowA.includes('000500') && await A.isVisible('.top10 .scores li.mine'));

// ---- a second player sees it and beats it; the first player's board updates live
const B = await open();
await until(B, (d) => d.board.shared.length === 1);
ok('another player sees the score', (await topRows(B))[0].includes('ACE'));
await finishWith(B, 900);
await B.fill('#score-name', 'bea');
await B.click('button:has-text("SAVE")');
await B.locator('text=SAVED · #1 ON THE TOP 10').waitFor();
await until(A, (d) => d.board.shared[0]?.name === 'BEA');
ok('boards update live in other tabs', (await topRows(A))[1].includes('ACE'));

// ---- only ten make it
for (let i = 0; i < 9; i++) {
  await finishWith(A, 1000 + i * 10);
  await A.click('button:has-text("SAVE")');
  await A.locator('text=SAVED').waitFor();
}
// wait for the last save to arrive, not just for ten entries
await until(B, (d) => d.board.shared.length === 10 && d.board.shared[0].score === 1080);
const all = await ev(B, (d) => d.board.shared.map((e) => e.score));
ok('board keeps the ten best, highest first', all.length === 10 && all[0] === 1080 && all[9] === 900 && !all.includes(500) && all.every((v, i) => i === 0 || all[i - 1] >= v));
await finishWith(B, 100);
ok('a score that doesn’t make it gets no save offer', !(await B.isVisible('#score-name')));
ok('device board still records it', await B.isVisible('text=ON THIS DEVICE’S TOP 10'));
await B.click('.top10 [role=tab]:has-text("THIS DEVICE")');
ok('this-device tab shows local scores', (await topRows(B)).some((t) => t.includes('000100')));

// ---- view-only player: can read, isn't offered a save
const V = await open('#readonly');
await until(V, (d) => d.board.shared.length === 10);
await finishWith(V, 5000);
ok('view-only player sees the board but no save box', !(await V.isVisible('#score-name')) && await V.isVisible('text=#1 ON THIS DEVICE’S TOP 10'));

// ---- junk in someone else's document is cleaned, never run
await A.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('mockdb'));
  all['scores/evil'] = { name: '<img src=x onerror=alert(1)>', best: [{ n: '<script>alert(1)</script>', s: 1e12, lv: 'x', at: 'y' }, { n: 'NEG', s: -5 }, 'junk', null] };
  localStorage.setItem('mockdb', JSON.stringify(all));
  new BroadcastChannel('mockdb').postMessage(1);
});
await until(A, (d) => d.board.shared.some((e) => e.score === 9999990));
const evil = await ev(A, (d) => d.board.shared.find((e) => e.score === 9999990));
ok('bad entries are clamped and their names cleaned', evil.name === 'SCRIPTALERT1' && evil.level === 1 && !(await ev(A, (d) => d.board.shared.some((e) => e.name === 'NEG'))));
ok('nothing from the data ran', !(await A.locator('.top10 img, .top10 script').count()));

// ---- title menu Top 10 screen, and icons
await A.keyboard.press('Escape');
await A.keyboard.press('Digit4');
ok('Top 10 screen from the title menu', await A.isVisible('.scores-panel .scores li'));
await (await A.$('.frame')).screenshot({ path: 'test-results/top10-screen.png' }).catch(() => {});
await A.locator('.top10').screenshot({ path: 'test-results/top10-section.png' }).catch(() => {});
await A.locator('.info section:nth-child(2)').screenshot({ path: 'test-results/icons-legend.png' }).catch(() => {});
await A.keyboard.press('Escape');
await A.keyboard.press('Digit3');
await A.click('button.side.sub');
await ev(A, (d) => { const { S } = d; S.sub.shield = true; S.sub.twin = 600; S.sub.rapid = 600; S.boat.armor = true; S.boat.cluster = 600; S.boat.rapid = 600; S.boat.inv = 0; S.items = [];
  ['shield', 'twin', 'rapid', 'life'].forEach((k, i) => { d.spawnItem('sub', k, 20 + i * 30); S.items.at(-1).y = 60; S.items.at(-1).v = 0; });
  ['armor', 'cluster', 'reload'].forEach((k, i) => d.spawnItem('ship', k, 100 + i * 14 > 140 ? 10 + i * 14 : 100 + i * 14)); S.cool = 1e6; });
await A.waitForTimeout(150);
await (await A.$('.frame')).screenshot({ path: 'test-results/icons-game.png' }).catch(() => {});
ok('no page errors or popups', errors.length === 0);
if (errors.length) console.log(errors);
await browser.close();
process.exit(fails.length ? 1 : 0);
