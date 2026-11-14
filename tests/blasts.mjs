// Area blasts: chain reactions, damage that scales with distance, proximity fuses, self-damage,
// shields, ships taking partial damage, and evened-out fire rates.
import { chromium, checker, ev, until } from './harness.mjs';

const url = process.argv[2];
const { ok, fails } = checker();
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 900, height: 1000 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(url);
await until(p, (d) => !!d);

// a quiet 1 player game: no computer ships, no power-ups, the sub parked
async function quiet() {
  await ev(p, (d) => { const { S } = d; S.spawn = 1e9; S.ships = []; S.puSub = 1e9; S.items = []; S.charges = []; S.torps = []; S.inv = 0; S.hull = 100; S.lives = 3; S.sub.shield = false; S.cool = 1e9; });
}
const settle = () => p.waitForTimeout(250);
await p.keyboard.press('Digit1');
await until(p, (d) => d.screen() === 'play');
const A = await ev(p, (d) => d.ARMS);

// ---- shooting a charge sets off the charges around it, not the ones out of range
await quiet();
const score0 = await ev(p, (d) => d.S.score);
await ev(p, (d) => { const { S } = d; S.charges = [{ x: 60, y: 60, v: 0 }, { x: 68, y: 62, v: 0 }, { x: 110, y: 60, v: 0 }]; S.torps = [{ x: 59, y: 62 }]; });
await until(p, (d) => d.S.charges.length === 1);
const left = await ev(p, (d) => d.S.charges.map((c) => c.x));
ok('a shot charge sets off its neighbour (chain reaction)', JSON.stringify(left) === '[110]');
ok('charges out of range survive', left.length === 1);
ok('each charge in the chain scores', (await ev(p, (d) => d.S.score)) - score0 === 20);
ok('a blast far away does not touch the sub', (await ev(p, (d) => d.S.hull)) === 100);

// ---- damage falls off with distance (seabed blasts at growing distances from the sub)
const losses = [];
for (const off of [1, 5, 9, 13, 17]) {
  await quiet();
  await ev(p, (d, o) => { const { S } = d; S.charges = [{ x: S.sub.x + 12 + o, y: 110.5, v: 0.6 }]; }, off);
  await settle();
  losses.push(100 - (await ev(p, (d) => d.S.hull)));
}
console.log('  hull lost at 1, 5, 9, 13, 17 units:', losses.map((v) => Math.round(v)).join(', '));
ok('closer blasts do more damage', losses.every((v, i) => i === 0 || losses[i - 1] > v || (losses[i - 1] === 0 && v === 0)));
ok('a blast right beside the sub does most of a hull', losses[0] > 55 && losses[0] < 70);
ok('outside the blast radius does nothing', losses[4] === 0);

// ---- proximity fuse: a charge falling onto the sub goes off just above it
await quiet();
await ev(p, (d) => { const { S } = d; S.charges = [{ x: S.sub.x + 6, y: 80, v: 1 }]; });
let maxY = 0;
for (let i = 0; i < 40; i++) {
  const s = await ev(p, (d) => ({ n: d.S.charges.length, y: d.S.charges[0]?.y ?? 0, sy: d.S.sub.y }));
  if (!s.n) break;
  maxY = Math.max(maxY, s.y);
  await p.waitForTimeout(16);
}
const prox = await ev(p, (d) => ({ hull: d.S.hull, lives: d.S.lives, sy: d.S.sub.y }));
ok('a falling charge goes off before it touches the sub', maxY < prox.sy && prox.hull < 100);
ok('one close charge damages but does not cost a life', prox.lives === 3 && prox.hull > 20);

// ---- shooting a charge just above you hurts you too
await quiet();
await ev(p, (d) => { const { S } = d; S.charges = [{ x: S.sub.x + 6, y: S.sub.y - 10, v: 0 }]; S.torps = [{ x: S.sub.x + 5, y: S.sub.y - 7 }]; });
await settle();
const self = await ev(p, (d) => d.S.hull);
ok('shooting a charge too close above you hurts you', self < 100 && self > 50);

// ---- a shield takes a whole blast
await quiet();
await ev(p, (d) => { const { S } = d; S.sub.shield = true; S.charges = [{ x: S.sub.x + 13, y: 110.5, v: 0.6 }]; });
await settle();
ok('a shield absorbs a blast', (await ev(p, (d) => [d.S.hull, d.S.sub.shield])).join() === '100,false');

// ---- a hull running out costs a life and refills
await quiet();
await ev(p, (d) => { const { S } = d; S.hull = 10; S.charges = [{ x: S.sub.x + 13, y: 110.5, v: 0.6 }]; });
await settle();
ok('running out of hull costs a life and refills it', (await ev(p, (d) => [d.S.lives, d.S.hull])).join() === '2,100');

// ---- torpedoes against ships: a hit near the hull sinks a freighter, a near miss only damages it
await quiet();
await ev(p, (d) => { const { S } = d; S.ships = [{ x: 60, y: 17, v: 0, hp: d.ARMS.shipHull, cool: 1e9 }]; S.torps = [{ x: 67, y: 45 }]; });
await until(p, (d) => d.S.ships.length === 0, null, 3000);
ok('a torpedo going off under a freighter sinks it', (await ev(p, (d) => d.S.sunk)) === 1);
await ev(p, (d) => { const { S } = d; S.ships = [{ x: 60, y: 17, v: 0, hp: d.ARMS.shipHull, cool: 1e9 }]; S.torps = [{ x: 82, y: 45 }]; });
await settle();
const ship = await ev(p, (d) => d.S.ships[0] && d.S.ships[0].hp);
ok('a near miss at the surface damages a ship without sinking it', ship > 0 && ship < A.shipHull);

// ---- fire rates
async function countWhileHolding(key, type, ms) {
  await ev(p, (d, t) => { d.__count = 0; d.__max = 0; const f = d.FX[t]; d.FX[t] = (...a) => { d.__count++; f(...a); }; d.__restore = () => { d.FX[t] = f; }; }, type);
  const watch = setInterval(() => p.evaluate(() => { const d = window.__dr; d.__max = Math.max(d.__max, d.S.torps.length, d.S.charges.length); }).catch(() => {}), 30);
  await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key);
  clearInterval(watch);
  return ev(p, (d) => { d.__restore(); return { n: d.__count, max: d.__max }; });
}
await quiet();
await ev(p, (d) => { d.S.cool = 0; });
const torps = await countWhileHolding('Space', 'fire', 2000);
console.log('  torpedoes in 2 s:', torps.n, 'most in the water:', torps.max);
ok('torpedo reload holds the sub to about two shots a second', torps.n >= 3 && torps.n <= 6);
ok('no more than three torpedoes in the water', torps.max <= A.torpMax);

await p.keyboard.press('Escape');
await p.keyboard.press('Digit3');
await p.click('button.side.ship');
await until(p, (d) => d.screen() === 'play');
await ev(p, (d) => { const { S } = d; S.boat.cool = 0; S.charges = []; S.inv = 1e9; S.puShip = 1e9; S.puSub = 1e9; S.items = []; });
const drops = await countWhileHolding('Space', 'drop', 2000);
console.log('  charges dropped in 2 s:', drops.n, 'most in the water:', drops.max);
ok('charge reload is on a par with torpedoes', drops.n >= 3 && drops.n <= 5 && Math.abs(drops.n - torps.n) <= 2);
ok('no more than four charges in the water', drops.max <= A.chgMax);

// ---- a charge blown up under the destroyer damages it
await p.keyboard.press('Escape');
await p.keyboard.press('Digit3');
await p.click('button.side.sub');
await until(p, (d) => d.screen() === 'play');
await ev(p, (d) => { const { S } = d; S.boat.inv = 0; S.boat.armor = false; S.boat.hull = 100; S.charges = [{ x: S.boat.x + 8, y: 27, v: 0 }]; S.torps = [{ x: S.boat.x + 7, y: 29 }]; });
await settle();
const bh = await ev(p, (d) => d.S.boat.hull);
ok('a charge set off near the surface damages the destroyer', bh < 100);

ok('no page errors', errors.length === 0);
if (errors.length) console.log(errors);
await browser.close();
process.exit(fails.length ? 1 : 0);
