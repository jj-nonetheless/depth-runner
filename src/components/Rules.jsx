// How to play, shown under the game.
export default function Rules() {
  return (
    <>
      <div class="info">
        <section>
          <h2>Controls</h2>
          <dl>
            <dt><kbd>&larr;</kbd> <kbd>&rarr;</kbd></dt><dd>Steer (A / D also work)</dd>
            <dt><kbd>SPACE</kbd></dt><dd>Sub: fire a torpedo (or &uarr;). Ship: drop a charge (or S).</dd>
            <dt><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></dt><dd>On the title screen: 1 player, online, vs computer</dd>
            <dt><kbd>ENTER</kbd></dt><dd>Play again after a game</dd>
            <dt><kbd>P</kbd> <kbd>ESC</kbd></dt><dd>Pause (not online) / leave</dd>
          </dl>
        </section>
        <section>
          <h2>Power-ups</h2>
          <h3 class="s">Sub: catch capsules as they sink</h3>
          <dl>
            <dt><span class="cap def">S</span></dt><dd>Shield: blocks one hit</dd>
            <dt><span class="cap off">T</span></dt><dd>Twin torpedoes, 10 sec</dd>
            <dt><span class="cap spd">R</span></dt><dd>Rapid fire, 10 sec</dd>
            <dt><span class="cap life">+</span></dt><dd>Extra sub (rare, 1 player, level 2+)</dd>
          </dl>
          <h3 class="b">Ship: drive over buoys</h3>
          <dl>
            <dt><span class="cap def">A</span></dt><dd>Armor: blocks one torpedo</dd>
            <dt><span class="cap off">C</span></dt><dd>Cluster: 3 charges per drop, 10 sec</dd>
            <dt><span class="cap spd">R</span></dt><dd>Fast reload, 10 sec</dd>
          </dl>
          <p class="note">They turn up more often the longer a game runs. Losing a life loses timed power-ups.</p>
        </section>
        <section>
          <h2>1 Player</h2>
          <dl>
            <dt>Depth charge</dt><dd class="pts">10 PTS</dd>
            <dt>Ship sunk</dt><dd class="pts">100 PTS</dd>
            <dt>Every 8 ships</dt><dd>Level up: faster ships, more charges</dd>
            <dt>Subs</dt><dd>3 to start</dd>
          </dl>
          <h2 class="gap">2 Players</h2>
          <dl>
            <dt>Lobby</dt><dd>See who else has the game open, challenge someone, or accept a challenge.</dd>
            <dt>Sides</dt><dd>Each player picks sub or ship, then presses Ready.</dd>
            <dt>Win</dt><dd>3 lives each. Sink the other side 3 times.</dd>
            <dt>Left early</dt><dd>If your opponent leaves, the computer takes over.</dd>
          </dl>
          <p class="note">Online play works on claude.ai for people who are signed in and have access to this page. Anyone else can play the computer.</p>
        </section>
      </div>
      <p class="note">Ships cross the surface and roll depth charges down on you. Shoot the charges on the way down, or put a torpedo through the hull and stop them at the source. A remake of a half-remembered cassette game.</p>
    </>
  );
}
