// One page, no online room: 1 player, every power-up, and 2 players against the computer.
import { chromium, checker, ev, until } from './harness.mjs';

const url = process.argv[2];
const { ok, fails } = checker();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await until(page, (d) => d && d.net.status === 'offline');

// ---- title and 1 player
ok('title menu shows', await page.isVisible('text=2 PLAYERS ONLINE'));
await page.keyboard.press('Digit1');
ok('1 player starts', await ev(page, (d) => d.screen() === 'play' && d.S.mode === 1 && d.S.phase === 'play'));
await page.keyboard.down('Space'); await until(page, (d) => d.S.torps.length > 0); await page.keyboard.up('Space');
const x0 = await ev(page, (d) => d.S.sub.x);
await page.keyboard.down('ArrowLeft'); await until(page, (d, x) => d.S.sub.x < x - 5, x0); await page.keyboard.up('ArrowLeft');
ok('fire and steer', true);

// ---- power-ups
await ev(page, (d) => { d.S.puSub = 1; });
await until(page, (d) => d.S.items.length > 0 || d.S.msg.o === 'sub');
ok('capsule spawns', true);
await ev(page, (d) => { d.S.items = []; d.S.torps = []; d.S.cool = 0; d.spawnItem('sub', 'twin', d.S.sub.x + 2); d.S.items[0].y = d.S.sub.y - 3; });
await until(page, (d) => d.S.sub.twin > 0);
await page.keyboard.down('Space'); await until(page, (d) => d.S.torps.length >= 2); await page.keyboard.up('Space');
ok('twin torpedoes fire in pairs', await ev(page, (d) => d.S.torps.length === 2 && d.S.torps[0].y === d.S.torps[1].y));
await ev(page, (d) => { d.applySub('rapid'); d.S.sub.twin = 0; d.S.torps = []; d.S.cool = 0; });
await page.keyboard.down('Space'); await until(page, (d) => d.S.torps.length > 0); await page.keyboard.up('Space');
ok('rapid fire shortens reload', await ev(page, (d) => d.S.cool <= d.ARMS.torpCoolRapid && d.ARMS.torpCoolRapid < d.ARMS.torpCool));
await ev(page, (d) => { d.S.sub.shield = true; d.S.inv = 0; d.S.charges = [{ x: d.S.sub.x + 6, y: d.S.sub.y + 1, v: 0 }]; });
await until(page, (d) => !d.S.sub.shield);
ok('shield blocks one hit', await ev(page, (d) => d.S.lives === 3));
await ev(page, (d) => { d.S.sub.twin = 500; d.S.hull = 1; d.S.inv = 0; d.S.charges = [{ x: d.S.sub.x + 6, y: d.S.sub.y + 1, v: 0 }]; });
await until(page, (d) => d.S.lives === 2);
ok('losing a life clears timed power-ups', await ev(page, (d) => d.S.sub.twin === 0 && d.S.sub.rapid === 0));
await ev(page, (d) => d.applySub('life'));
ok('extra sub', await ev(page, (d) => d.S.lives === 3));

// ---- game over screen
await ev(page, (d) => { d.S.lives = 1; d.S.hull = 1; d.S.inv = 0; d.S.sub.shield = false; d.S.charges = [{ x: d.S.sub.x + 6, y: d.S.sub.y + 1, v: 0 }]; });
await until(page, (d) => d.screen() === 'over');
ok('game over screen', await page.isVisible('text=GAME OVER') && await page.isVisible('button:has-text("PLAY AGAIN")'));
await page.keyboard.press('Enter');
ok('enter plays again', await ev(page, (d) => d.screen() === 'play' && d.S.lives === 3));

// ---- lobby without a room explains itself
await page.keyboard.press('Escape');
await page.keyboard.press('Digit2');
ok('lobby says offline and why', await page.isVisible('.status.offline') && await page.isVisible('text=Online play only works on claude.ai'));

// ---- 2 players vs computer, as the ship
await page.click('button:has-text("PLAY THE COMPUTER")');
ok('pick a side vs computer', await page.isVisible('text=YOU VS COMPUTER'));
await page.click('button.side.ship');
ok('ship vs computer starts', await ev(page, (d) => d.screen() === 'play' && d.S.mode === 2 && d.S.myRole === 'ship' && d.S.opp === 'cpu'));
const sx = await ev(page, (d) => d.S.sub.x);
await until(page, (d, x) => Math.abs(d.S.sub.x - x) > 3, sx);
ok('computer steers the sub', true);
await ev(page, (d) => { d.S.items = []; d.spawnItem('ship', 'cluster', d.S.boat.x + 4); });
await until(page, (d) => d.S.boat.cluster > 0);
await ev(page, (d) => { d.S.boat.cool = 0; d.S.charges = []; });
await page.keyboard.down('Space'); await until(page, (d) => d.S.charges.length > 0); await page.keyboard.up('Space');
ok('cluster drops three', await ev(page, (d) => d.S.charges.length === 3));
await ev(page, (d) => { d.applyShip('reload'); d.S.boat.cool = 0; d.S.charges = []; d.S.boat.cluster = 0; });
await page.keyboard.down('KeyS'); await until(page, (d) => d.S.charges.length > 0); await page.keyboard.up('KeyS');
ok('fast reload', await ev(page, (d) => d.S.boat.cool <= 18));
const livesBefore = await ev(page, (d) => d.S.boatLives);
await ev(page, (d) => { d.S.cool = 1e6; d.S.charges = []; d.applyShip('armor'); d.S.boat.inv = 0; d.S.boat.down = 0; d.S.torps = [{ x: d.S.boat.x + 6, y: d.S.boat.y + 8 }]; });
await until(page, (d) => !d.S.boat.armor);
ok('armor blocks one torpedo', await ev(page, (d, n) => d.S.boatLives === n, livesBefore));
await ev(page, (d) => { d.S.boatLives = 1; d.S.boat.hull = 1; d.S.boat.down = 0; d.S.boat.inv = 0; d.S.torps = [{ x: d.S.boat.x + 6, y: d.S.boat.y + 8 }]; });
await until(page, (d) => d.screen() === 'over');
ok('sub wins, you lose', await page.isVisible('text=SUB WINS!') && await page.isVisible('text=YOU LOSE') && await page.isVisible('button:has-text("CHANGE SIDE")'));
await page.click('button:has-text("PLAY AGAIN")');
ok('play again keeps your side', await ev(page, (d) => d.screen() === 'play' && d.S.myRole === 'ship'));

// ---- worst-case online snapshot fits the 4 KiB presence limit
const bytes = await ev(page, (d) => {
  const { S } = d;
  S.charges = Array.from({ length: 8 }, (_, i) => ({ x: 12.34 + i, y: 55.55 }));
  S.torps = Array.from({ length: 6 }, () => ({ x: 123.4, y: 66.6 }));
  S.items = [];
  for (let i = 0; i < 4; i++) { d.spawnItem('sub', 'twin'); d.spawnItem('ship', 'cluster'); }
  S.evs = Array.from({ length: 12 }, (_, i) => [1e6 + i, 'subhit', 123, 111]);
  S.msg = { text: 'x', c: '', t: 90, k: 'reload', o: 'ship' };
  return JSON.stringify({ dr: 2, nick: 'WWWWWWWWWWWW', st: 'play', inv: 'k3v6q2rt7wacd4fn', no: 'k3v6q2rt7wacd4fn', role: 'ship', ready: true, in: null, s: d.encode() }).length;
});
console.log('  worst-case presence bytes:', bytes);
ok('snapshot fits in presence', bytes < 4096);

await page.screenshot({ path: 'test-results/solo.png' }).catch(() => {});
ok('no page errors', errors.length === 0);
if (errors.length) console.log(errors);
await browser.close();
process.exit(fails.length ? 1 : 0);
