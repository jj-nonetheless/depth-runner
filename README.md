# Depth Runner

A small Commodore 64–style arcade game. You steer a submarine along the seabed while ships pass overhead and
drop depth charges. Fire torpedoes upward to destroy the charges or sink the ships. Play alone, against a
friend online, or against the computer.

Built with [SolidJS](https://www.solidjs.com/) and [Vite](https://vite.dev/). The build is a single
self-contained `index.html`.

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
- On touch screens, on-screen ← → and FIRE/DROP buttons appear during a game.

## Power-ups

Colour shows the kind (cyan = defence, orange = weapon, yellow = speed); the letter says which.
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

## Scoring and winning

- 1 player: depth charge 10 points, ship 100 points, level up every 8 ships, 3 lives.
- 2 players: 3 lives each. The sub wins by torpedoing the ship 3 times; the ship wins by hitting the sub 3 times.

## How the code is laid out

```
src/
  game/        constants, engine (rules + state), ai, render (canvas), snapshot (online sync), input, sound
  net/room.js  the online lobby: presence, challenges, matching
  controller.js  screen flow and the 60 Hz loop; decides who runs the game online
  components/  Solid screens over the canvas (title, lobby, sides, results), touch pads, rules
tests/         solo.mjs (one page), online.mjs (tabs sharing tests/mockroom.js, a stand-in for the room)
```

Online, everything travels in **presence**, the part of the room every viewer may send. Each page shares its
name, where it is (title, lobby, in a match), who it's challenging, its side and whether it's ready. Two
pages that challenge each other are a match. During a game the sub player's page runs the game and shares a
snapshot about 30 times a second; the ship player's page sends its keys and draws the snapshots.

## Publishing to claude.ai

`npm run build` writes `dist/artifact.html`, the page in the form the Artifact tool publishes. Publish it with
the `room` capability declared (`capabilities: {room: {}}`).
