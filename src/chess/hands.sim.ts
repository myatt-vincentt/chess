// Reading the hands, one reading at a time (pure, so it can be tested).
//
// Pinch: thumb tip to index tip, measured on the hand's own 3D joints in palm
// lengths, so it reads the same near or far from the camera. It closes below
// one distance and opens only above a larger one, so it never flickers.
//
// Open palm: the four fingers straight and the thumb well away from the index
// (so a pinch is never taken for a palm), held for a couple of readings.
//
// Orbit: both palms open, one hand still (the anchor) and the other moving.
// The moving palm turns the board (left / right) and tilts it (up / down).
// Small wobbles are ignored (a dead zone) and speeds are smoothed, so the
// board doesn't jitter; closing or dropping either hand ends it.

export const HANDS = {
  /** Pinch closes below / opens above this thumb–index gap (palm lengths). */
  pinchOn: 0.3,
  pinchOff: 0.45,
  /** An open palm needs at least this thumb–index gap (palm lengths). */
  openGap: 0.62,
  /** Readings in a row to start / end an open palm. */
  openOn: 2,
  openOff: 2,
  /** Palm speed (palm sizes per second): still below, moving above. */
  still: 1.1,
  moving: 1.7,
  /** Smoothing of the palm speed per reading (0 = none). */
  speedSmooth: 0.5,
  /** Movement under this share of the screen per reading is ignored. */
  deadZone: 0.0035,
  /** Board turn for a sweep across the whole screen width (radians). */
  turnPerWidth: 3.4,
  /** Board tilt for a sweep down the whole screen height (radians). */
  tiltPerHeight: 2.2,
};

export type Point = { x: number; y: number };

/** One hand reading, in canvas pixels (and the pinch gap in palm lengths). */
export type HandReading = {
  t: number;
  pinch: Point;
  palm: Point;
  /** Wrist to middle knuckle on screen (px). */
  palmSize: number;
  pinchGap: number;
  /** The fingers are straight (thumb aside). */
  fingersOpen: boolean;
};

export type HandState = {
  seen: boolean;
  t: number;
  pinched: boolean;
  /** The last thumb–index gap (palm lengths). */
  gap: number;
  open: boolean;
  openRun: number;
  closedRun: number;
  pinch: Point;
  palm: Point;
  /** Palm movement since the previous reading (px). */
  step: Point;
  /** Smoothed palm speed (palm sizes per second). */
  speed: number;
};

export const handState = (): HandState => ({
  seen: false,
  t: 0,
  pinched: false,
  gap: 1,
  open: false,
  openRun: 0,
  closedRun: 0,
  pinch: { x: 0, y: 0 },
  palm: { x: 0, y: 0 },
  step: { x: 0, y: 0 },
  speed: 0,
});

/** Take a reading. Returns what changed: the pinch closing or opening. */
export const feedHand = (s: HandState, r: HandReading) => {
  const wasPinched = s.pinched;
  s.gap = r.pinchGap;
  if (s.pinched) s.pinched = r.pinchGap < HANDS.pinchOff;
  else s.pinched = r.pinchGap < HANDS.pinchOn;

  const openNow = r.fingersOpen && r.pinchGap > HANDS.openGap && !s.pinched;
  if (openNow) {
    s.openRun += 1;
    s.closedRun = 0;
  } else {
    s.closedRun += 1;
    s.openRun = 0;
  }
  if (!s.open && s.openRun >= HANDS.openOn) s.open = true;
  if (s.open && s.closedRun >= HANDS.openOff) s.open = false;

  const gap = s.seen ? r.t - s.t : 0;
  if (s.seen && gap > 0 && gap < 400) {
    s.step = { x: r.palm.x - s.palm.x, y: r.palm.y - s.palm.y };
    const speed =
      Math.hypot(s.step.x, s.step.y) / Math.max(1, r.palmSize) / (gap / 1000);
    s.speed = s.speed * HANDS.speedSmooth + speed * (1 - HANDS.speedSmooth);
  } else {
    s.step = { x: 0, y: 0 };
    s.speed = 0;
  }
  s.seen = true;
  s.t = r.t;
  s.pinch = { ...r.pinch };
  s.palm = { ...r.palm };
  return {
    pinchStarted: s.pinched && !wasPinched,
    pinchEnded: !s.pinched && wasPinched,
  };
};

export const loseHand = (s: HandState) => {
  s.seen = false;
  s.pinched = false;
  s.open = false;
  s.openRun = 0;
  s.closedRun = 0;
  s.speed = 0;
  s.step = { x: 0, y: 0 };
};

export type Side = "left" | "right";

export type Orbit = {
  active: boolean;
  /** The moving hand, once one is moving. */
  mover: Side | null;
};

export const orbitState = (): Orbit => ({ active: false, mover: null });

const softDeadZone = (v: number, dz: number) =>
  Math.abs(v) <= dz ? 0 : v - Math.sign(v) * dz;

/**
 * After a reading of `side`: is the two-palm orbit on, and how far does the
 * board turn and tilt (radians)?
 */
export const orbitStep = (
  o: Orbit,
  hands: Record<Side, HandState>,
  side: Side,
  screen: { width: number; height: number },
  allowed: boolean,
) => {
  const both = hands.left.seen && hands.right.seen;
  const open = both && hands.left.open && hands.right.open;
  o.active = allowed && open;
  if (!o.active) {
    o.mover = null;
    return { turn: 0, tilt: 0 };
  }
  const other: Side = side === "left" ? "right" : "left";
  // Pick the mover: clearly moving while the other is still.
  if (!o.mover) {
    if (hands[side].speed > HANDS.moving && hands[other].speed < HANDS.still) {
      o.mover = side;
    } else if (
      hands[other].speed > HANDS.moving &&
      hands[side].speed < HANDS.still
    ) {
      o.mover = other;
    }
  } else if (hands[o.mover].speed < HANDS.still * 0.5) {
    // The mover has settled: free to pick again.
    o.mover = null;
  }
  if (o.mover !== side) return { turn: 0, tilt: 0 };
  const anchor = hands[other];
  // Both hands sweeping is not an orbit.
  if (anchor.speed > HANDS.moving) return { turn: 0, tilt: 0 };
  const dx = softDeadZone(hands[side].step.x / screen.height, HANDS.deadZone);
  const dy = softDeadZone(hands[side].step.y / screen.height, HANDS.deadZone);
  return {
    turn: dx * (screen.height / screen.width) * HANDS.turnPerWidth,
    tilt: dy * HANDS.tiltPerHeight,
  };
};
