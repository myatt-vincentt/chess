import { describe, expect, it } from "vitest";

import { CLOCKS, LEVELS, goCommand, levelOptions } from "./levels";

describe("levels", () => {
  it("has six presets, rising in strength", () => {
    expect(LEVELS).toHaveLength(6);
    LEVELS.slice(1).forEach((l, i) =>
      expect(l.elo).toBeGreaterThan(LEVELS[i].elo),
    );
  });

  it("uses Skill Level below Stockfish's Elo floor and UCI_Elo inside its range", () => {
    LEVELS.forEach((l) => {
      const opts = levelOptions(l);
      if (l.uciElo === null) {
        expect(opts).toContain("setoption name UCI_LimitStrength value false");
        expect(opts).toContain(`setoption name Skill Level value ${l.skill}`);
      } else {
        expect(l.uciElo).toBeGreaterThanOrEqual(1320);
        expect(l.uciElo).toBeLessThanOrEqual(3190);
        expect(opts).toContain("setoption name UCI_LimitStrength value true");
        expect(opts).toContain(`setoption name UCI_Elo value ${l.uciElo}`);
      }
    });
  });

  it("builds the search command", () => {
    expect(goCommand(400, null)).toBe("go movetime 400");
    expect(goCommand(150, 1)).toBe("go depth 1 movetime 150");
    expect(goCommand(10, null)).toBe("go movetime 50");
  });

  it("offers off, 5, 10 and 3+2", () => {
    expect(CLOCKS.map((c) => c.label)).toEqual([
      "Off",
      "5 min",
      "10 min",
      "3+2",
    ]);
  });
});
