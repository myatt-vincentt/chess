// Every piece on the board keeps its own identity, so a move animates the very
// piece that moved, a capture sends that piece to the tray, and an undo brings
// it back. chess.js knows the position; the roster knows which piece is which.

export type Color = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type Square = `${"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"}${
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"}`;

export type Piece = {
  id: string;
  color: Color;
  type: PieceType;
  /** Where it stands, or null once captured. */
  square: Square | null;
  /** Its place in the capturing side's tray (0, 1, …) once captured. */
  tray: number;
  /** Which way a knight faces: chosen by the file it started on. */
  facing: number;
};

export type Roster = readonly Piece[];

/** The parts of a chess.js verbose move the roster needs. */
export type MoveInfo = {
  color: Color;
  from: string;
  to: string;
  flags: string;
  promotion?: string;
};

const FILES = "abcdefgh";
const BACK: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];

export const fileOf = (sq: string) => FILES.indexOf(sq[0]);
export const rankOf = (sq: string) => Number(sq[1]) - 1;
export const squareAt = (file: number, rank: number): Square | null =>
  file >= 0 && file < 8 && rank >= 0 && rank < 8
    ? (`${FILES[file]}${rank + 1}` as Square)
    : null;

export const initialRoster = (): Roster => {
  const pieces: Piece[] = [];
  (["w", "b"] as Color[]).forEach((color) => {
    const back = color === "w" ? 0 : 7;
    const pawns = color === "w" ? 1 : 6;
    for (let f = 0; f < 8; f += 1) {
      pieces.push({
        id: `${color}${BACK[f]}${f}`,
        color,
        type: BACK[f],
        square: squareAt(f, back),
        tray: 0,
        facing: f < 4 ? 1 : -1,
      });
      pieces.push({
        id: `${color}p${f}`,
        color,
        type: "p",
        square: squareAt(f, pawns),
        tray: 0,
        facing: f < 4 ? 1 : -1,
      });
    }
  });
  return pieces;
};

/** The roster after `move` (a new array; pieces are copied when they change). */
export const applyMove = (roster: Roster, move: MoveInfo): Roster => {
  const next = roster.map((p) => ({ ...p }));
  const at = (sq: string) => next.find((p) => p.square === sq);
  const captured = next.filter(
    (p) => p.square === null && p.color !== move.color,
  ).length;
  // En passant takes the pawn beside the destination, not on it.
  const victimSquare = move.flags.includes("e")
    ? `${move.to[0]}${move.from[1]}`
    : move.to;
  const victim =
    move.flags.includes("c") || move.flags.includes("e")
      ? at(victimSquare)
      : undefined;
  const mover = at(move.from);
  if (victim && victim !== mover) {
    victim.square = null;
    victim.tray = captured;
  }
  if (mover) {
    mover.square = move.to as Square;
    if (move.promotion) mover.type = move.promotion as PieceType;
  }
  // Castling moves the rook too.
  if (move.flags.includes("k") || move.flags.includes("q")) {
    const rank = move.from[1];
    const [rookFrom, rookTo] = move.flags.includes("k")
      ? [`h${rank}`, `f${rank}`]
      : [`a${rank}`, `d${rank}`];
    const rook = at(rookFrom);
    if (rook) rook.square = rookTo as Square;
  }
  return next;
};

/** Captured pieces of `color` (taken by the other side), in capture order. */
export const capturedOf = (roster: Roster, color: Color) =>
  roster
    .filter((p) => p.color === color && p.square === null)
    .sort((a, b) => a.tray - b.tray);
