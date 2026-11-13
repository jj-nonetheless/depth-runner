# Depth Runner

A small Commodore 64–style arcade game. You steer a submarine along the seabed while ships
pass overhead and drop depth charges. Fire torpedoes upward to destroy the charges or sink the ships.

## Play

Open `index.html` in any modern browser. No install or build step.

## Controls

- **Left / Right** (or A / D): move the sub
- **Space**: fire a torpedo (up to 3 on screen)
- **Enter**: start, or restart after game over
- **P**: pause
- On touch screens, on-screen ← → and FIRE buttons appear; tap the screen to start.

## Scoring

- Depth charge: 10 points
- Ship: 100 points
- Level goes up every 8 ships sunk; ships get faster and drop charges more often
- 3 lives. The high score is saved in the browser.

## Test

A headless browser smoke test (needs Playwright):

    node tests/smoke.js "$PWD/index.html"
