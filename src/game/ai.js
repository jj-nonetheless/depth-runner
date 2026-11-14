// Computer players for 2-player mode: one plays the destroyer, the other the sub.
import { W, SURF, BED } from './constants.js';
import { S } from './engine.js';

let ai = { t: 0, tx: 72, fire: false };
export function resetAi() { ai = { t: 0, tx: 72, fire: false }; }

export function aiShip() {
  const { boat, sub } = S;
  if (--ai.t <= 0) {
    ai.t = (8 + Math.random() * 10) | 0;
    const buoy = S.items.find((i) => i.owner === 'ship');
    let tx = buoy ? buoy.x - 4 : sub.x - 2 + (Math.random() - 0.5) * 24;
    const incoming = S.torps.find((t) => t.y < SURF + 45 && t.x > boat.x - 4 && t.x < boat.x + 20);
    if (incoming) tx = incoming.x < boat.x + 8 ? boat.x + 30 : boat.x - 30;
    ai.tx = Math.max(0, Math.min(W - 16, tx));
  }
  const dx = ai.tx - boat.x;
  const overSub = Math.abs(boat.x + 8 - (sub.x + 6)) < 10 + (boat.cluster > 0 ? 6 : 0);
  return { l: dx < -1, r: dx > 1, a: overSub && Math.random() < 0.5 };
}

export function aiSub() {
  const { boat, sub } = S;
  if (--ai.t <= 0) {
    ai.t = (6 + Math.random() * 8) | 0;
    const cx = sub.x + 6;
    const threat = S.charges.filter((c) => c.y > SURF + 20 && Math.abs(c.x - cx) < 16).sort((a, b) => b.y - a.y)[0];
    // a torpedo takes ~42 ticks to reach the surface, so aim where the ship will be
    const lead = boat.x + 8 + boat.vx * 42;
    let tx;
    if (threat && threat.y > BED - 45) tx = (threat.x < cx ? cx + 24 : cx - 24) - 6;
    else {
      const pu = S.items.find((i) => i.owner === 'sub' && i.y > SURF + 30);
      tx = pu ? pu.x - 2 : boat.down ? sub.x : lead - 4;
    }
    if (tx < 2 && threat) tx = threat.x + 10;
    if (tx > W - 14 && threat) tx = threat.x - 22;
    ai.tx = Math.max(0, Math.min(W - 12, tx));
    ai.fire = (boat.down === 0 && boat.inv === 0 && Math.abs(sub.x + 4 - lead) < 5 && Math.random() < 0.7)
      // shoot a charge only while it is still far enough above that its blast can't reach us
      || (!!threat && Math.abs(threat.x - (sub.x + 5)) < 3 && threat.y < sub.y - 22);
  }
  const dx = ai.tx - sub.x;
  return { l: dx < -1, r: dx > 1, a: ai.fire };
}
