// Board sounds, synthesised (no files): a wooden click when a piece lands, a
// deeper thud on a capture, a soft two-note chime on check and a short rising
// fanfare on checkmate. Silent until a tap turns sound on (browsers only start
// audio from one).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let enabled = false;

const makeNoise = (c: AudioContext) => {
  const b = c.createBuffer(1, Math.round(c.sampleRate * 0.5), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  return b;
};

/** Start audio (call from a tap). */
export const unlockAudio = () => {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(comp).connect(ctx.destination);
      noise = makeNoise(ctx);
    }
    if (ctx.state !== "running") void ctx.resume();
  } catch {
    ctx = null;
  }
};

export const setSoundEnabled = (on: boolean) => {
  enabled = on;
  if (on) unlockAudio();
};

export const soundEnabled = () => enabled;

/** A short burst of filtered noise: the contact of wood on wood. */
const knock = (
  c: AudioContext,
  out: AudioNode,
  t: number,
  freq: number,
  q: number,
  level: number,
  decay: number,
) => {
  if (!noise) return;
  const src = c.createBufferSource();
  src.buffer = noise;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(bp).connect(g).connect(out);
  src.start(t, Math.random() * 0.3);
  src.stop(t + decay + 0.02);
};

/** A decaying sine: the body of the board ringing. */
const tone = (
  c: AudioContext,
  out: AudioNode,
  t: number,
  freq: number,
  level: number,
  attack: number,
  decay: number,
  type: OscillatorType = "sine",
  glideTo?: number,
) => {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + decay);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(level, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
};

export type Sfx = "move" | "capture" | "check" | "mate";

export const playSfx = (kind: Sfx) => {
  if (!enabled || !ctx || !master) return;
  const c = ctx;
  const out = master;
  const t = c.currentTime + 0.01;
  if (kind === "move") {
    knock(c, out, t, 2300, 1.4, 0.55, 0.05);
    knock(c, out, t, 900, 2, 0.35, 0.08);
    tone(c, out, t, 240, 0.25, 0.002, 0.09, "sine", 170);
  } else if (kind === "capture") {
    knock(c, out, t, 1500, 1.1, 0.6, 0.07);
    knock(c, out, t, 420, 1.2, 0.55, 0.16);
    tone(c, out, t, 130, 0.5, 0.003, 0.22, "sine", 80);
  } else if (kind === "check") {
    tone(c, out, t + 0.06, 988, 0.11, 0.012, 0.9);
    tone(c, out, t + 0.06, 1976, 0.03, 0.012, 0.5);
    tone(c, out, t + 0.2, 1319, 0.1, 0.012, 1.1);
    tone(c, out, t + 0.2, 2637, 0.025, 0.012, 0.6);
  } else {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const at = t + 0.12 + i * 0.13;
      const hold = i === 3 ? 1.4 : 0.35;
      tone(c, out, at, f, 0.12, 0.02, hold, "triangle");
      tone(c, out, at, f * 2, 0.025, 0.02, hold * 0.7, "sine");
    });
    tone(c, out, t + 0.51, 523.25, 0.07, 0.03, 1.4, "triangle");
    tone(c, out, t + 0.51, 659.25, 0.06, 0.03, 1.4, "triangle");
  }
};
