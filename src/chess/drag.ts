// Picking up and putting down a piece, the same for the mouse, a finger and
// a pinch in the air. A picked piece shows where it may go; carried, it
// floats above the board under the pointer or the pinch; dropped on a lit
// square it moves there, anywhere else it eases back to where it was.
import { Vector3 } from "three";

import { canPick, game, legalTargets, userMove } from "./game";
import type { MoveSource } from "./game";
import { localToSquare, squareToLocal } from "./space";
import type { Square } from "./roster";

/** How high a carried piece floats (squares). */
export const LIFT = 0.55;

export const drag = {
  /** The picked or selected piece's square, and its legal destinations. */
  selected: null as Square | null,
  targets: [] as Square[],
  /** A piece is in the air. */
  carrying: false,
  source: null as MoveSource | null,
  /** The carried piece's foot, in board space. */
  pos: new Vector3(),
  /** The square under the carried piece. */
  hover: null as Square | null,
  /** The hand's ring on the board (board space), when a hand is over it. */
  cursor: { visible: false, x: 0, z: 0, pinched: false },
};

const idAt = (sq: Square) =>
  game.roster.find((p) => p.square === sq)?.id ?? null;

/** The id of the piece in the air, if any. */
export const carriedId = () =>
  drag.carrying && drag.selected ? idAt(drag.selected) : null;

/** Light up a piece's moves without lifting it (click to move). */
export const select = (sq: Square | null) => {
  if (sq && canPick(sq)) {
    drag.selected = sq;
    drag.targets = legalTargets(sq);
  } else {
    drag.selected = null;
    drag.targets = [];
  }
  drag.carrying = false;
  drag.hover = null;
};

/** Pick up the piece on `sq`. False when it isn't the player's to move. */
export const pickUp = (sq: Square, source: MoveSource) => {
  if (!canPick(sq)) return false;
  select(sq);
  drag.carrying = true;
  drag.source = source;
  squareToLocal(sq, LIFT, drag.pos);
  drag.hover = sq;
  return true;
};

/** Carry the piece to board point (x, z). */
export const carryTo = (x: number, z: number) => {
  if (!drag.carrying) return;
  drag.pos.set(
    Math.max(-5, Math.min(5, x)),
    LIFT,
    Math.max(-5, Math.min(5, z)),
  );
  drag.hover = localToSquare(drag.pos.x, drag.pos.z);
};

/**
 * Put the piece down. Moves it when over a legal square and returns true;
 * otherwise it goes back. A piece put back on its own square stays selected
 * (`keepSelection`), so a click-to-move can follow.
 */
export const drop = (keepSelection = false): boolean => {
  if (!drag.carrying || !drag.selected) return false;
  const from = drag.selected;
  const to = drag.hover;
  const source = drag.source ?? "pointer";
  drag.carrying = false;
  drag.hover = null;
  if (to && to !== from && drag.targets.includes(to)) {
    select(null);
    return userMove(from, to, source);
  }
  if (!keepSelection || to !== from) select(null);
  return false;
};

/** Click-to-move: a tap on `sq` with a piece selected. */
export const tapSquare = (sq: Square | null, source: MoveSource): boolean => {
  const from = drag.selected;
  if (from && sq && drag.targets.includes(sq)) {
    select(null);
    return userMove(from, sq, source);
  }
  select(sq && sq !== from ? sq : null);
  return false;
};

/** Forget any pick (a new game, an undo, the computer's turn). */
export const clearDrag = () => {
  drag.carrying = false;
  drag.selected = null;
  drag.targets = [];
  drag.hover = null;
};
