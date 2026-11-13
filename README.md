# Depth Runner

A small Commodore 64–style arcade game. You steer a submarine along the seabed while ships
pass overhead and drop depth charges. Fire torpedoes upward to destroy the charges or sink the ships.

## Play

Open `index.html` in any modern browser. No install or build step.

## Modes

- **1 player**: the sub against computer-run ships.
- **2 players**: one player is the sub, the other drives a destroyer on the surface and drops the charges.

Press 1 or 2 (or use the mode buttons) to start. Enter restarts, P pauses, Esc goes back to the title.

## Controls

- **Sub**: Left / Right to steer (A / D also work in 1 player), Up or Space to fire (up to 3 torpedoes on screen)
- **Ship (2 players)**: A / D to steer, S to drop a depth charge (one every ~2/3 second, 5 in the water at most)
- On touch screens, on-screen buttons appear for the sub, and for the ship in 2 player mode.

## Scoring (1 player)

- Depth charge: 10 points
- Ship: 100 points
- Level goes up every 8 ships sunk; ships get faster and drop charges more often
- 3 lives. The high score is saved in the browser.

## Winning (2 players)

Each side has 3 lives. The sub wins by torpedoing the ship 3 times; the ship wins by hitting the sub 3 times.
A sunk ship comes back from one edge of the screen after a short pause.

## Test

A headless browser smoke test (needs Playwright):

    node tests/smoke.js "$PWD/index.html"
