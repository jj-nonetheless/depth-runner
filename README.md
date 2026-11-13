# Depth Runner

A small Commodore 64–style arcade game. You steer a submarine along the seabed while ships
pass overhead and drop depth charges. Fire torpedoes upward to destroy the charges or sink the ships.

## Play

Open `index.html` in any modern browser. No install or build step.

## Modes

- **1 player**: the sub against computer-run ships.
- **2 players**: pick a side, sub or ship. The game looks for someone else with the page open who picked the
  other side and connects you. If nobody turns up within 15 seconds (or you press C), the computer plays the
  other side. If your opponent leaves mid-game, the computer takes over their side.

Online play uses the claude.ai artifact `room` capability, so it only works when the page is opened on claude.ai
by people who are signed in and have access to it. Anywhere else (a public link, or `index.html` opened
straight from disk) 2 players goes straight to playing the computer.

How the online game works: the sub player's browser runs the game and shares a snapshot of it about 30 times a
second; the ship player's browser sends its key presses and draws the snapshots it receives.

## Controls

- **← / →** (or A / D): steer
- **Space**: the sub fires a torpedo (also ↑); the ship drops a depth charge (also S)
- **1 / 2**: 1 player, or choose a side for 2 players
- **Enter**: start, or play again / rematch
- **C**: while waiting for player 2, play the computer now
- **P**: pause (not in online games) — **Esc**: back to the title
- On touch screens, on-screen ← → and FIRE/DROP buttons appear.

## Power-ups

Colour shows the kind (cyan = defence, orange = weapon, yellow = speed); the letter says which.
They turn up every 9–18 seconds at first, closer together as a game goes on.
Losing a life loses any timed power-up.

**Sub** — capsules sink from the surface and rest on the seabed for a few seconds; drive into one to collect it.

- **S** Shield: blocks one depth charge hit
- **T** Twin torpedoes: fires two at once, up to 6 on screen, for 10 seconds
- **R** Rapid fire: much shorter reload, for 10 seconds
- **+** Extra sub: rare, 1 player only, from level 2

**Ship (2 players)** — buoys bob on the surface for a few seconds; drive over one to collect it.

- **A** Armor: blocks one torpedo hit
- **C** Cluster: drops 3 charges side by side, for 10 seconds
- **R** Fast reload: for 10 seconds

## Scoring (1 player)

- Depth charge: 10 points
- Ship: 100 points
- Level goes up every 8 ships sunk; ships get faster and drop charges more often
- 3 lives. The high score is saved in the browser.

## Winning (2 players)

Each side has 3 lives. The sub wins by torpedoing the ship 3 times; the ship wins by hitting the sub 3 times.
A sunk ship comes back from one edge of the screen after a short pause.
## Test

Headless browser tests (need Playwright):

    node tests/smoke.js "$PWD/index.html"

    # online play: serve the folder, then two tabs share a stand-in for the room capability
    python3 -m http.server 8765 &
    node tests/net-smoke.js http://127.0.0.1:8765/index.html tests/mockroom.js
