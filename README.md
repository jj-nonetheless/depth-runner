# Depth Runner

A 16-bit style arcade game. You steer a submarine along the seabed while ships pass overhead and
drop depth charges. Fire torpedoes upward to destroy the charges or sink the ships. Play alone, against a
friend online, or against the computer.

Built with [SolidJS](https://www.solidjs.com/) and [Vite](https://vite.dev/). The build is a single
self-contained `index.html`.

Each player picks how it looks, **8-bit** or **16-bit**, with the switch in the header or the **G** key. The
choice is saved in that browser and only changes that player's screen, so two people can play one online
match in different looks. The game itself (rules, timing, online sync) is identical either way.

- **8-bit**: the original Commodore 64 look, drawn at the native 160x120.
- **16-bit**: drawn at 320x240: shaded sprites with outlines, a sunset sky,
parallax layers (clouds, islands, light rays, three rock and kelp layers, fish, bubbles and drifting specks)
that move with the current and the sub, animated propellers, wakes and funnel smoke, tumbling depth charges,
layered explosions, splashes, shockwaves, ships that tilt and sink, and screen shake.

## The start screen

Every visit opens on a pre-rendered title, in the style of 1980s box art and demo-scene intros. On the
first visit a small ray tracer in the page renders the scene line by line on screen (a glossy submarine
breaking the surface in front of a striped sunset sun, on a sea with a neon grid that reflects the sky and
the sub), then dithers it down to the look's palette: the 512 colours of a Mega Drive for 16-bit, or the
16 colours of a Commodore 64 at half resolution for 8-bit. The render is saved in the browser, so later
visits skip straight to the show. The chrome logo is pre-rendered too: bevelled, mirror-finished with a
sky-over-ground reflection, extruded and glowing. Then attract mode runs: the logo crashes in, a shine
sweeps across it, the sun throws a lens flare, raster bars roll behind PRESS START, a sine-wave scroller
runs along the bottom, and the Top 10 comes up every so often. Press start (Enter, Space, a click or a tap)
for a fanfare and the title menu; pressing it while the scene is still tracing skips straight to the menu.

## Run it

```sh
npm install
npm run dev        # local dev server with hot reload
npm run build      # dist/index.html (open it straight from disk) and dist/artifact.html (for claude.ai)
npm test           # browser tests against the build (needs Playwright installed)
```

## Modes

- **1 player**: the sub against computer-run ships. Score points, level up, chase the high score.
- **2 players online**: open the lobby to see who else has the game open. Challenge someone or accept a
  challenge, then each of you picks a side (sub or ship) and presses Ready. If your opponent leaves
  mid-game, the computer takes over their side.
- **2 players vs computer**: pick a side; the computer plays the other.

Online play uses the claude.ai artifact `room` capability, so it only works when the page is opened on
claude.ai by people who are signed in and have access to it. Anywhere else the lobby says it's offline and
explains why, and the computer is still available.

## Controls

- **← / →** (or A / D): steer
- **Space**: the sub fires a torpedo (also ↑); the ship drops a depth charge (also S)
- **1 / 2 / 3** on the title screen: 1 player, online lobby, vs computer
- **Enter**: play again after a game
- **P**: pause (not in online games) · **Esc**: leave
- **G**: switch between 8-bit and 16-bit graphics
- On touch screens, on-screen ← → and FIRE/DROP buttons appear during a game.

## Power-ups

Colour shows the kind (cyan = defence, orange = weapon, yellow = speed); the pixel icon says which.
They turn up every 9–18 seconds at first, closer together as a game goes on. Losing a life loses any timed
power-up.

**Sub**: capsules sink from the surface and rest on the seabed for a few seconds; drive into one.

- **S** Shield: blocks one depth charge hit
- **T** Twin torpedoes: fires two at once, up to 6 on screen, for 10 seconds
- **R** Rapid fire: much shorter reload, for 10 seconds
- **+** Extra sub: rare, 1 player only, from level 2

**Ship (2 players)**: buoys bob on the surface for a few seconds; drive over one.

- **A** Armor: blocks one torpedo hit
- **C** Cluster: drops 3 charges side by side, for 10 seconds
- **R** Fast reload: for 10 seconds

## Blasts and damage

Torpedoes and depth charges explode with an area blast. Damage is full at the centre and falls to nothing
at the edge, so a near miss still hurts and a distant one doesn't. The sub, the destroyer and the computer's
freighters all have a hull: run it down and you lose a life (or the ship sinks), and the hull refills.

- **Depth charges** go off when they come close to the sub, hit the seabed, are shot, or are caught in
  another blast, so shooting one can set off a chain reaction. Shoot one too close above you and the
  blast reaches you as well.
- **Torpedoes** go off near a ship or at the surface, so a near miss still damages a ship.
- **Reload** is evened out: the sub fires about two torpedoes a second with at most three in the water
  (rapid fire roughly doubles it); the destroyer drops about two charges a second with at most four.
  The numbers live in one table, `ARMS` in `src/game/engine.js`.

## Scoring and winning

- 1 player: each charge you set off 10 points (chain reactions included), ship 100 points, level up every 8 ships, 3 lives.
- 2 players: 3 lives each, each with a full hull. The side that sinks the other 3 times wins.

## How the code is laid out

```
src/
  game/        constants, engine (rules + state), ai, snapshot (online sync), input, sound
               render (picks the look), render8 (8-bit), render16 + art + scene (16-bit), vfx (visual effects)
  start/       the start screen's ray tracer, render cache, chrome logo and palette dithering
  look.js      the player's 8-bit / 16-bit choice; look8.css and look16.css style the page for each
  net/room.js  the online lobby: presence, challenges, matching
  controller.js  screen flow and the 60 Hz loop; decides who runs the game online
  components/  Solid screens over the canvas (title, lobby, sides, results), touch pads, rules
tests/         solo.mjs (one page), online.mjs (tabs sharing tests/mockroom.js, a stand-in for the room),
               scores.mjs (the Top 10, with tests/mockdb.js), looks.mjs (8-bit / 16-bit), start.mjs (start screen),
               touch.mjs (touch controls), blasts.mjs (area blasts, damage, fire rates)
```

Online, everything travels in **presence**, the part of the room every viewer may send. Each page shares its
name, where it is (title, lobby, in a match), who it's challenging, its side and whether it's ready. Two
pages that challenge each other are a match. During a game the sub player's page runs the game and shares a
snapshot about 30 times a second; the ship player's page sends its keys and draws the snapshots.

## Publishing to claude.ai

`npm run build` writes `dist/artifact.html`, the page in the form the Artifact tool publishes. Publish it with
the `room` capability declared (`capabilities: {room: {}}`).
