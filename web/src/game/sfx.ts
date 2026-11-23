/**
 * Tiny sound effects made with the Web Audio API, so there are no sound files to load.
 * iPad Safari only allows sound after a tap, so the context starts on the first touch.
 */
let ctx: AudioContext | null = null;
export function unlockAudio() {
  if (ctx || typeof window === "undefined") return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (AC) ctx = new AC();
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.15, slideTo?: number, delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur);
}

export const sfx = {
  gem: () => { tone(988, 0.08, "square", 0.06); tone(1318, 0.12, "square", 0.06, undefined, 0.06); },
  bigGem: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.15, "triangle", 0.1, undefined, i * 0.07)),
  jump: () => tone(300, 0.15, "square", 0.05, 600),
  gateOpen: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.2, "triangle", 0.12, undefined, i * 0.08)),
  wrong: () => { tone(220, 0.25, "sawtooth", 0.08, 110); },
  warp: () => tone(1200, 0.5, "sine", 0.1, 150),
  egg: () => [659, 784, 988, 1319, 1568].forEach((f, i) => tone(f, 0.18, "triangle", 0.12, undefined, i * 0.09)),
  portal: () => tone(180, 0.8, "sine", 0.12, 900),
  finale: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.25, "triangle", 0.12, undefined, i * 0.12)),
};
