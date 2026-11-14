// Two (then three) tabs sharing a stand-in for the claude.ai room (tests/mockroom.js):
// the lobby, challenges, picking sides, an online game, rematch, and leaving mid-game.
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
const toLobby = async (p, nick) => {
  await p.click('button:has-text("2 PLAYERS ONLINE")');
  await p.fill('#nick', nick);
  await p.press('#nick', 'Enter');
};
const row = (p, nick) => p.locator('.players li', { hasText: nick });

const A = await open();
const B = await open();
await toLobby(A, 'alice');
await toLobby(B, 'bob');

// ---- lobby: each sees the other
await row(A, 'BOB').waitFor();
await row(B, 'ALICE').waitFor();
ok('players see each other in the lobby', await row(A, 'BOB').innerText().then((t) => t.includes('IN THE LOBBY')));
ok('status counts other players', await A.isVisible('text=ONLINE · 1 OTHER PLAYER HERE'));

// ---- challenge, decline
await row(A, 'BOB').locator('button:has-text("CHALLENGE")').click();
await B.locator('.invite', { hasText: 'ALICE WANTS TO PLAY' }).waitFor();
ok('challenge reaches the other player', true);
ok('challenger sees waiting', await A.isVisible('text=WAITING FOR BOB TO ACCEPT'));
await B.click('.invite button:has-text("DECLINE")');
await A.locator('.notice', { hasText: 'BOB DECLINED' }).waitFor();
ok('decline clears the challenge', await ev(A, (d) => d.mine.inv === null));

// ---- challenge, accept -> both pick sides
await row(A, 'BOB').locator('button:has-text("CHALLENGE")').click();
await B.locator('.invite', { hasText: 'ALICE WANTS TO PLAY' }).waitFor();
await B.click('.invite button:has-text("ACCEPT")');
await until(A, (d) => d.screen() === 'roles');
await until(B, (d) => d.screen() === 'roles');
ok('accepting matches both players', await A.isVisible('text=YOU VS BOB') && await B.isVisible('text=YOU VS ALICE'));

// ---- picking sides
await A.click('button.side.sub');
await B.click('button.side.sub');
await A.locator('text=YOU BOTH PICKED SUB').waitFor();
ok('same side is flagged', await A.isDisabled('button:has-text("READY")'));
await B.click('button.side.ship');
await A.locator('button.side.ship', { hasText: 'BOB PICKED THIS' }).waitFor();
ok('you see what the other player picked', true);
await A.click('button:has-text("READY")');
await B.locator('text=ALICE IS READY').waitFor();
ok('ready is shown to the other player', await ev(A, (d) => d.screen() === 'roles'));
await B.click('button:has-text("READY")');
await until(A, (d) => d.screen() === 'play');
await until(B, (d) => d.screen() === 'play');
ok('both ready starts the game', await ev(A, (d) => d.S.opp === 'remote' && d.S.myRole === 'sub' && d.S.record)
  && await ev(B, (d) => d.S.opp === 'remote' && d.S.myRole === 'ship' && !d.S.record));

// ---- online play: ship keys go to the sub's page, the game comes back
const bx = await ev(A, (d) => d.S.boat.x);
await B.bringToFront();
await B.keyboard.down('ArrowRight');
await until(A, (d, x) => d.S.boat.x > x + 10, bx);
await B.keyboard.up('ArrowRight');
await until(B, (d, x) => d.S.boat.x > x + 10, bx);
ok('ship steering crosses over and back', true);
await ev(A, (d) => { d.S.boat.cool = 0; });
await B.keyboard.down('Space'); await until(A, (d) => d.S.charges.length > 0); await B.keyboard.up('Space');
await until(B, (d) => d.S.charges.length > 0);
ok('depth charge shows on both screens', true);
await A.bringToFront();
await ev(A, (d) => { d.S.cool = 0; });
await A.keyboard.down('Space'); await until(B, (d) => d.S.torps.length > 0); await A.keyboard.up('Space');
ok('torpedo shows on both screens', true);
await ev(A, (d) => d.applySub('twin'));
await until(B, (d) => d.S.msg.text === 'TWIN TORPS' && d.S.sub.twin > 0);
ok('power-ups show on both screens', true);
await ev(A, (d) => { d.S.hull = 55; d.S.boat.hull = 40; d.S.inv = 1e9; d.S.boat.inv = 1e9; });
await until(B, (d) => d.S.hull === 55 && d.S.boat.hull === 40);
ok('hull damage shows on both screens', true);
await ev(A, (d) => { d.S.inv = 0; d.S.boat.inv = 0; });

// ---- sub wins; both see it
await ev(A, (d) => { const { S } = d; S.boatLives = 1; S.boat.hull = 1; S.boat.down = 0; S.boat.inv = 0; S.boat.armor = false; S.torps = [{ x: S.boat.x + 6, y: S.boat.y + 8 }]; });
await until(A, (d) => d.screen() === 'over');
await until(B, (d) => d.screen() === 'over');
ok('both see the result', await A.isVisible('text=YOU WIN') && await B.isVisible('text=YOU LOSE'));

// ---- rematch, swapping sides; a stale ready from the last game must not start it early
await A.click('button:has-text("REMATCH")');
await A.locator('text=BOB IS STILL ON THE RESULTS SCREEN').waitFor();
await A.click('button.side.ship');
await A.waitForTimeout(600);
ok('no early start while the other player is on results', await ev(A, (d) => d.screen() === 'roles'));
await B.click('button:has-text("REMATCH")');
await B.click('button.side.sub');
await A.click('button:has-text("READY")');
await B.click('button:has-text("READY")');
await until(A, (d) => d.screen() === 'play');
await until(B, (d) => d.screen() === 'play');
ok('rematch with sides swapped', await ev(B, (d) => d.S.record && d.S.myRole === 'sub') && await ev(A, (d) => d.S.myRole === 'ship' && !d.S.record));

// ---- the sub player leaves mid-game: the computer takes over the sub on the ship player's page
await B.bringToFront();
await B.keyboard.press('Escape');
await until(A, (d) => d.S.opp === 'cpu');
ok('computer takes over when the opponent leaves', await ev(A, (d) => d.S.msg.text === 'BOB LEFT - CPU ON' && d.screen() === 'play'));
const sx = await ev(A, (d) => d.S.sub.x);
await until(A, (d, x) => Math.abs(d.S.sub.x - x) > 3, sx);
ok('game carries on, computer steering the sub', true);
ok('leaver is back in the lobby', await ev(B, (d) => d.screen() === 'lobby' && d.mine.inv === null));

// ---- a third player shows up
const C = await open();
await toLobby(C, 'cat');
await row(B, 'CAT').waitFor();
ok('third player appears', await row(B, 'ALICE').innerText().then((t) => t.includes('IN A MATCH')));
ok('players in a match cannot be challenged', await row(B, 'ALICE').locator('button').count() === 0);
await A.screenshot({ path: 'test-results/online-a.png' }).catch(() => {});
await B.screenshot({ path: 'test-results/online-lobby.png' }).catch(() => {});

ok('no page errors', errors.length === 0);
if (errors.length) console.log(errors);
await browser.close();
process.exit(fails.length ? 1 : 0);
