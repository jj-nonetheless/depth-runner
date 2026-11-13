let ac;

export function beep(freq, dur, type = 'square', vol = 0.05) {
  try {
    ac = ac || new AudioContext();
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(ac.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.stop(ac.currentTime + dur);
  } catch {
    // no audio in this browser; the game plays silently
  }
}

const seq = (notes) => notes.forEach(([f, d, at]) => setTimeout(() => beep(f, d), at));

export const jingle = () => seq([[660, 0.07, 0], [880, 0.07, 70], [1320, 0.1, 140]]);
export const startJingle = () => seq([[440, 0.1, 0], [660, 0.12, 90]]);
export const levelJingle = () => seq([[523, 0.1, 0], [784, 0.15, 100]]);
export const winJingle = () => seq([[523, 0.12, 0], [659, 0.12, 120], [784, 0.25, 240]]);
