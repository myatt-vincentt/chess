import { describe, expect, it } from "vitest";

import { HANDS, feedHand, handState, orbitState, orbitStep } from "./hands.sim";
import type { HandReading } from "./hands.sim";

const reading = (t: number, over: Partial<HandReading> = {}): HandReading => ({
  t,
  pinch: { x: 100, y: 100 },
  palm: { x: 100, y: 160 },
  palmSize: 80,
  pinchGap: 0.8,
  fingersOpen: true,
  ...over,
});
const SCREEN = { width: 1000, height: 800 };

describe("pinch", () => {
  it("closes below one gap and opens only above a larger one", () => {
    const s = handState();
    feedHand(s, reading(0, { pinchGap: 0.4 }));
    expect(s.pinched).toBe(false);
    expect(
      feedHand(s, reading(50, { pinchGap: HANDS.pinchOn - 0.01 })).pinchStarted,
    ).toBe(true);
    feedHand(s, reading(100, { pinchGap: 0.4 }));
    expect(s.pinched).toBe(true);
    expect(
      feedHand(s, reading(150, { pinchGap: HANDS.pinchOff + 0.01 })).pinchEnded,
    ).toBe(true);
  });

  it("never reads a pinch as an open palm", () => {
    const s = handState();
    for (let i = 0; i < 6; i += 1) {
      feedHand(s, reading(i * 50, { pinchGap: 0.1, fingersOpen: true }));
      expect(s.open).toBe(false);
    }
  });

  it("needs a couple of readings to open or close the palm", () => {
    const s = handState();
    feedHand(s, reading(0));
    expect(s.open).toBe(false);
    feedHand(s, reading(50));
    expect(s.open).toBe(true);
    feedHand(s, reading(100, { fingersOpen: false }));
    expect(s.open).toBe(true);
    feedHand(s, reading(150, { fingersOpen: false }));
    expect(s.open).toBe(false);
  });
});

describe("two-palm orbit", () => {
  const run = (
    left: (i: number) => Partial<HandReading> | null,
    right: (i: number) => Partial<HandReading> | null,
  ) => {
    const hands = { left: handState(), right: handState() };
    const o = orbitState();
    let turn = 0;
    let tilt = 0;
    for (let i = 0; i < 30; i += 1) {
      (["left", "right"] as const).forEach((side) => {
        const over = (side === "left" ? left : right)(i);
        if (!over) return;
        feedHand(hands[side], reading(i * 50, over));
        const d = orbitStep(o, hands, side, SCREEN, true);
        turn += d.turn;
        tilt += d.tilt;
      });
    }
    return { turn, tilt };
  };
  const still = (x: number) => () => ({ palm: { x, y: 400 } });

  it("turns with the moving palm while the other stays still", () => {
    const r = run(still(200), (i) => ({ palm: { x: 500 + i * 12, y: 400 } }));
    expect(r.turn).toBeGreaterThan(0.3);
    expect(Math.abs(r.tilt)).toBeLessThan(0.01);
  });

  it("tilts with up and down", () => {
    const r = run(still(200), (i) => ({ palm: { x: 600, y: 300 + i * 10 } }));
    expect(r.tilt).toBeGreaterThan(0.2);
  });

  it("ignores one palm, two moving palms, a pinch, and small wobbles", () => {
    expect(
      run(
        () => null,
        (i) => ({ palm: { x: 500 + i * 12, y: 400 } }),
      ).turn,
    ).toBe(0);
    expect(
      run(
        (i) => ({ palm: { x: 100 + i * 12, y: 400 } }),
        (i) => ({ palm: { x: 500 + i * 12, y: 400 } }),
      ).turn,
    ).toBe(0);
    expect(
      run(
        () => ({ palm: { x: 200, y: 400 }, pinchGap: 0.1 }),
        (i) => ({ palm: { x: 500 + i * 12, y: 400 } }),
      ).turn,
    ).toBe(0);
    const wobble = run(still(200), (i) => ({
      palm: { x: 600 + (i % 2) * 2, y: 400 },
    }));
    expect(wobble.turn).toBe(0);
  });
});
