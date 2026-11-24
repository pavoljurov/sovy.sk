import { storage } from './storage';

// All sounds are synthesised — no audio files to load.
let ac: AudioContext | null = null;
let muted = storage.get('muted') === '1';

function audio(): AudioContext | null {
  try {
    if (!ac) {
      const C =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ac = new C();
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  } catch {
    return null;
  }
}

function tone(freq: number, at = 0, dur = 0.15, type: OscillatorType = 'triangle', vol = 0.2, slideTo?: number): void {
  if (muted) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  tap: () => tone(700, 0, 0.06, 'triangle', 0.1),
  correct: () => {
    tone(523, 0, 0.12);
    tone(659, 0.08, 0.12);
    tone(784, 0.16, 0.22);
  },
  wrong: () => {
    tone(320, 0, 0.16, 'sawtooth', 0.06, 240);
    tone(240, 0.14, 0.24, 'sawtooth', 0.06, 170);
  },
  pop: () => tone(950, 0, 0.09, 'square', 0.06, 280),
  step: () => tone(440, 0, 0.07, 'triangle', 0.08, 560),
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.22));
    [523, 659, 784].forEach((f) => tone(f, 0.5, 0.6, 'sine', 0.12));
  },
  isMuted: () => muted,
  setMuted(m: boolean) {
    muted = m;
    storage.set('muted', m ? '1' : '0');
    if (!m) sfx.tap();
  },
};
