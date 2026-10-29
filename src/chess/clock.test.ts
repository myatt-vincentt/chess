import { describe, expect, it } from "vitest";

import { createClock, formatClock, pressClock, tickClock } from "./clock.sim";

describe("clock", () => {
  it("waits for the first move, then runs the side to move", () => {
    const c = createClock(60_000, 0);
    expect(tickClock(c, 5_000)).toBeNull();
    expect(c.left).toEqual({ w: 60_000, b: 60_000 });
    pressClock(c, "w");
    tickClock(c, 2_000);
    expect(c.left).toEqual({ w: 60_000, b: 58_000 });
  });

  it("adds the increment to the side that moved", () => {
    const c = createClock(180_000, 2_000);
    pressClock(c, "w");
    tickClock(c, 3_000);
    pressClock(c, "b");
    expect(c.left.b).toBe(179_000);
    expect(c.running).toBe("w");
  });

  it("flags at zero and stops", () => {
    const c = createClock(1_000, 0);
    pressClock(c, "w");
    expect(tickClock(c, 600)).toBeNull();
    expect(tickClock(c, 600)).toBe("b");
    expect(c.left.b).toBe(0);
    expect(c.running).toBeNull();
  });

  it("formats minutes and the last ten seconds", () => {
    expect(formatClock(300_000)).toBe("5:00");
    expect(formatClock(61_200)).toBe("1:02");
    expect(formatClock(9_450)).toBe("0:09.4");
  });
});
