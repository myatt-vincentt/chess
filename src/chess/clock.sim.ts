// The chess clock: two times counting down, one per side. The side to move
// runs; the clock starts with the first move (white's thinking time before it
// is free) and a move adds the preset's increment to the side that made it.

export type Side = "w" | "b";

export type Clock = {
  /** Time left per side (ms). */
  left: Record<Side, number>;
  incrementMs: number;
  /** The side whose time runs, or null while stopped. */
  running: Side | null;
  /** The side that ran out of time. */
  flagged: Side | null;
};

export const createClock = (baseMs: number, incrementMs: number): Clock => ({
  left: { w: baseMs, b: baseMs },
  incrementMs,
  running: null,
  flagged: null,
});

/** Run the clock for `dtMs`. Returns the side that just ran out, if any. */
export const tickClock = (clock: Clock, dtMs: number): Side | null => {
  const side = clock.running;
  if (!side || clock.flagged) return null;
  clock.left[side] = Math.max(0, clock.left[side] - dtMs);
  if (clock.left[side] === 0) {
    clock.flagged = side;
    clock.running = null;
    return side;
  }
  return null;
};

/** `mover` finished a move: add the increment and start the other side. */
export const pressClock = (clock: Clock, mover: Side) => {
  if (clock.flagged) return;
  if (clock.running === mover) clock.left[mover] += clock.incrementMs;
  clock.running = mover === "w" ? "b" : "w";
};

export const stopClock = (clock: Clock) => {
  clock.running = null;
};

/** "4:59", or "0:09.4" under ten seconds. */
export const formatClock = (ms: number): string => {
  const t = Math.max(0, ms);
  if (t < 10_000) {
    const tenths = Math.floor(t / 100);
    return `0:0${Math.floor(tenths / 10)}.${tenths % 10}`;
  }
  const s = Math.ceil(t / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
