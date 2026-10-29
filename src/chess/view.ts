// How the board is turned and tilted, and how close it is. Mouse drags, the
// wheel, touch pinches and the two-palm gesture all move the targets; the
// board eases towards them every frame (strict ease-out, no overshoot).
//
// Turn spins the board about its own centre; tilt is the angle between the
// board and the screen (0 = edge-on, 90° = face-on).

const DEG = Math.PI / 180;

export const VIEW = {
  tilt: 50 * DEG,
  minTilt: 16 * DEG,
  maxTilt: 86 * DEG,
  minZoom: 0.65,
  maxZoom: 1.7,
  /** How fast the board follows (1/s). */
  follow: 9,
};

export type ViewState = {
  turn: number;
  tilt: number;
  zoom: number;
};

export const view = {
  now: { turn: 0, tilt: VIEW.tilt, zoom: 1 } as ViewState,
  target: { turn: 0, tilt: VIEW.tilt, zoom: 1 } as ViewState,
  /** The turn that puts the player's side nearest them. */
  baseTurn: 0,
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** The base turn nearest the current one, so a reset never spins round twice. */
const nearestBase = () =>
  view.baseTurn +
  2 * Math.PI * Math.round((view.target.turn - view.baseTurn) / (2 * Math.PI));

/** The player's colour: their side of the board comes to the front. */
export const setPlayerSide = (color: "w" | "b") => {
  view.baseTurn = color === "w" ? 0 : Math.PI;
  view.target.turn = nearestBase();
};

export const resetView = () => {
  view.target.turn = nearestBase();
  view.target.tilt = VIEW.tilt;
  view.target.zoom = 1;
};

export const orbitBy = (dTurn: number, dTilt: number) => {
  view.target.turn += dTurn;
  view.target.tilt = clamp(
    view.target.tilt + dTilt,
    VIEW.minTilt,
    VIEW.maxTilt,
  );
};

export const zoomBy = (factor: number) => {
  view.target.zoom = clamp(
    view.target.zoom * factor,
    VIEW.minZoom,
    VIEW.maxZoom,
  );
};

/** Ease the board towards its targets. */
export const stepView = (dt: number) => {
  const k = 1 - Math.exp(-VIEW.follow * Math.min(dt, 0.1));
  view.now.turn += (view.target.turn - view.now.turn) * k;
  view.now.tilt += (view.target.tilt - view.now.tilt) * k;
  view.now.zoom += (view.target.zoom - view.now.zoom) * k;
};
