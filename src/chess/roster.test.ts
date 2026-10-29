import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";

import { applyMove, capturedOf, initialRoster } from "./roster";
import type { Roster } from "./roster";

/** Play SAN moves on chess.js and the roster together. */
const playAll = (sans: string[]) => {
  const chess = new Chess();
  let roster: Roster = initialRoster();
  sans.forEach((san) => {
    roster = applyMove(roster, chess.move(san));
  });
  return { chess, roster };
};

/** The roster agrees with chess.js on every square. */
const agrees = (chess: Chess, roster: Roster) =>
  chess
    .board()
    .flat()
    .every((p) => {
      if (!p) return true;
      const r = roster.find((x) => x.square === p.square);
      return !!r && r.type === p.type && r.color === p.color;
    }) &&
  roster.filter((p) => p.square).length ===
    chess.board().flat().filter(Boolean).length;

describe("roster", () => {
  it("starts with 32 pieces, each with its own id", () => {
    const r = initialRoster();
    expect(r).toHaveLength(32);
    expect(new Set(r.map((p) => p.id)).size).toBe(32);
  });

  it("follows captures into the tray, in order", () => {
    const { chess, roster } = playAll([
      "e4",
      "d5",
      "exd5",
      "Qxd5",
      "Nc3",
      "Qxa2",
    ]);
    expect(agrees(chess, roster)).toBe(true);
    expect(capturedOf(roster, "b").map((p) => p.type)).toEqual(["p"]);
    expect(capturedOf(roster, "w").map((p) => [p.type, p.tray])).toEqual([
      ["p", 0],
      ["p", 1],
    ]);
  });

  it("castles the rook and takes en passant", () => {
    const { chess, roster } = playAll([
      "e4",
      "a6",
      "e5",
      "d5",
      "exd6",
      "a5",
      "Nf3",
      "a4",
      "Bc4",
      "a3",
      "O-O",
    ]);
    expect(agrees(chess, roster)).toBe(true);
    expect(roster.find((p) => p.id === "wr7")?.square).toBe("f1");
    expect(roster.find((p) => p.id === "bp3")?.square).toBeNull();
  });

  it("promotes the same piece", () => {
    const { chess, roster } = playAll([
      "e4",
      "d5",
      "exd5",
      "c6",
      "dxc6",
      "Nf6",
      "cxb7",
      "Nbd7",
      "bxa8=N",
    ]);
    expect(agrees(chess, roster)).toBe(true);
    const promoted = roster.find((p) => p.id === "wp4");
    expect(promoted?.square).toBe("a8");
    expect(promoted?.type).toBe("n");
  });

  it("stays in step through a whole random game", () => {
    const chess = new Chess();
    let roster: Roster = initialRoster();
    let seed = 3;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 300 && !chess.isGameOver(); i += 1) {
      const moves = chess.moves({ verbose: true });
      roster = applyMove(
        roster,
        chess.move(moves[Math.floor(rnd() * moves.length)]),
      );
      expect(agrees(chess, roster)).toBe(true);
    }
  });
});
