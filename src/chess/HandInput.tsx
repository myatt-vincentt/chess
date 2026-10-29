// Playing by hand.
//
// Pinch (thumb to index) on or near one of your pieces to pick it up: it
// lifts and follows the pinch above the board, with a glowing ring under it
// and its squares lit. Open the pinch over a lit square to put it down there;
// anywhere else it eases back.
//
// Two open palms orbit the board: keep one still and move the other; left and
// right turn it, up and down tilt it. Close or drop a hand to stop.
//
// The hand model runs about 20 times a second; between readings the pinch
// point glides smoothly. Tracker points are mirrored like the picture, so
// everything lands under the fingers on screen.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { XRModel, feedToViewport, trackerToFeed } from "@vincentt-xr/sdk";
import type { TrackerPoint } from "@vincentt-xr/sdk";
import {
  useXRModelNode,
  type XRModelNodeHandTracking,
} from "@vincentt-xr/sdk/low-level";
import { HandTracker } from "@vincentt-xr/sdk/tracking";
import { analyzeHandShape } from "@vincentt-xr/sdk/instructions";

import { LIFT, carryTo, drag, drop, pickUp } from "./drag";
import { canPick, game } from "./game";
import {
  feedHand,
  handState,
  loseHand,
  orbitState,
  orbitStep,
} from "./hands.sim";
import type { HandReading, HandState, Side } from "./hands.sim";
import { PIECE_HEIGHT } from "./pieces";
import {
  hitLevel,
  localToCanvas,
  localToSquare,
  space,
  squarePixels,
  squareToLocal,
} from "./space";
import type { Square } from "./roster";
import { orbitBy } from "./view";

/** Hand model rate (fixed: changing it restarts hand tracking). */
const HAND_FPS = 20;
/** A hand unseen this long (ms) lets go. */
const LOST_MS = 320;
/** A pinch reaches a piece within this many squares (on screen). */
const REACH = 0.75;
/** How fast the pinch point glides to each new reading (1/s). */
const GLIDE = 24;

const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const RING_MCP = 13;
const PINKY_MCP = 17;
const SIDES: Side[] = ["left", "right"];

/** Scripted hands for development checks (canvas px). */
export const devHands = {
  active: false,
  left: null as null | { x: number; y: number; pinch: boolean; open: boolean },
  right: null as null | { x: number; y: number; pinch: boolean; open: boolean },
};

/** A scripted hand's thumb–index gap (palm lengths). */
const fakeGap = (f: { pinch: boolean; open: boolean }) => {
  if (f.pinch) return 0.1;
  return f.open ? 0.9 : 0.45;
};

/** Development only: the live hand readings, for scripted checks. */
export const handDebug = {
  hands: null as Record<Side, HandState> | null,
  orbit: null as { active: boolean; mover: Side | null } | null,
  pinches: 0,
  releases: 0,
};

const dist3 = (a: TrackerPoint, b: TrackerPoint) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));

/** The nearest of your pieces to canvas point `p`, within reach. */
const pieceNear = (p: { x: number; y: number }): Square | null => {
  const reach = REACH * squarePixels();
  let best: Square | null = null;
  let bestD = reach;
  const v = new Vector3();
  game.roster.forEach((piece) => {
    if (!piece.square || !canPick(piece.square)) return;
    // Aim at the piece's middle, where a pinch naturally lands.
    squareToLocal(piece.square, PIECE_HEIGHT[piece.type] * 0.45, v);
    const c = localToCanvas(v);
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = piece.square;
    }
  });
  if (best) return best;
  // Or the square right under the pinch.
  const hit = hitLevel(p.x, p.y, 0);
  if (!hit) return null;
  const sq = localToSquare(hit.x, hit.z);
  return sq && canPick(sq) ? sq : null;
};

export const HandInput = () => {
  const node = useXRModelNode<XRModelNodeHandTracking>(XRModel.HAND_TRACKER);
  const hands = useMemo<Record<Side, HandState>>(
    () => ({ left: handState(), right: handState() }),
    [],
  );
  const orbit = useMemo(() => orbitState(), []);
  if (process.env.NODE_ENV !== "production") {
    handDebug.hands = hands;
    handDebug.orbit = orbit;
  }
  const stamps = useRef<Record<Side, number>>({ left: -1, right: -1 });
  const seenAt = useRef<Record<Side, number>>({ left: -1e9, right: -1e9 });
  const glide = useRef<Record<Side, { x: number; y: number } | null>>({
    left: null,
    right: null,
  });
  const holder = useRef<Side | null>(null);
  const offset = useRef({ x: 0, y: 0 });
  const lastFake = useRef(0);
  const hit = useMemo(() => new Vector3(), []);

  const toCanvas = (p: TrackerPoint) => {
    const v = feedToViewport(trackerToFeed(p), {
      width: space.width,
      height: space.height,
    });
    return { x: v.x, y: v.y };
  };

  /** A reading from a tracked hand. */
  const readPose = (
    image: readonly TrackerPoint[],
    world: readonly TrackerPoint[],
    t: number,
  ): HandReading => {
    const a = toCanvas(image[THUMB_TIP]);
    const b = toCanvas(image[INDEX_TIP]);
    const palmPts = [WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP].map(
      (i) => toCanvas(image[i]),
    );
    const palm = {
      x: palmPts.reduce((s, q) => s + q.x, 0) / palmPts.length,
      y: palmPts.reduce((s, q) => s + q.y, 0) / palmPts.length,
    };
    const palmLen = dist3(world[WRIST], world[MIDDLE_MCP]) || 1;
    const shape = analyzeHandShape(world);
    return {
      t,
      pinch: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      palm,
      palmSize: Math.hypot(
        palmPts[0].x - palmPts[2].x,
        palmPts[0].y - palmPts[2].y,
      ),
      pinchGap: dist3(world[THUMB_TIP], world[INDEX_TIP]) / palmLen,
      fingersOpen:
        shape.extended.index &&
        shape.extended.middle &&
        shape.extended.ring &&
        shape.extended.pinky,
    };
  };

  const onReading = (side: Side, r: HandReading, now: number) => {
    const s = hands[side];
    const { pinchStarted, pinchEnded } = feedHand(s, r);
    seenAt.current[side] = now;
    if (!glide.current[side]) glide.current[side] = { ...r.pinch };
    if (process.env.NODE_ENV !== "production") {
      if (pinchStarted) handDebug.pinches += 1;
      if (pinchEnded) handDebug.releases += 1;
    }
    const orbiting = orbit.active;
    if (pinchStarted && !holder.current && !orbiting) {
      const sq = pieceNear(s.pinch);
      if (sq && pickUp(sq, "hand")) {
        holder.current = side;
        squareToLocal(sq, LIFT, hit);
        const base = localToCanvas(hit);
        offset.current = { x: s.pinch.x - base.x, y: s.pinch.y - base.y };
      }
    }
    if (pinchEnded && holder.current === side) {
      holder.current = null;
      drop(false);
    }
    const step = orbitStep(
      orbit,
      hands,
      side,
      { width: space.width, height: space.height },
      !holder.current && game.phase !== "setup",
    );
    if (step.turn || step.tilt) orbitBy(step.turn, step.tilt);
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const now = performance.now();
    const fake = process.env.NODE_ENV !== "production" && devHands.active;
    if (fake) {
      if (now - lastFake.current > 1000 / HAND_FPS) {
        lastFake.current = now;
        SIDES.forEach((side) => {
          const f = devHands[side];
          if (!f) return;
          onReading(
            side,
            {
              t: now,
              pinch: { x: f.x, y: f.y },
              palm: { x: f.x, y: f.y + 60 },
              palmSize: 80,
              pinchGap: fakeGap(f),
              fingersOpen: f.open,
            },
            now,
          );
        });
      }
    } else {
      const poses = node?.poses;
      SIDES.forEach((side) => {
        const pose = poses?.[side];
        if (
          !pose ||
          pose.held ||
          pose.image.length < 21 ||
          pose.world.length < 21
        )
          return;
        if (pose.timestampMs === stamps.current[side]) return;
        stamps.current[side] = pose.timestampMs;
        onReading(
          side,
          readPose(pose.image, pose.world, pose.timestampMs),
          now,
        );
      });
    }

    let cursorSide: Side | null = null;
    for (let i = 0; i < SIDES.length; i += 1) {
      const side = SIDES[i];
      const s = hands[side];
      if (s.seen && now - seenAt.current[side] > LOST_MS) {
        loseHand(s);
        glide.current[side] = null;
        if (holder.current === side) {
          // Lost while carrying: the piece goes back.
          holder.current = null;
          drag.hover = null;
          drop(false);
        }
      }
      const g = glide.current[side];
      if (s.seen && g) {
        const k = 1 - Math.exp(-GLIDE * dt);
        g.x += (s.pinch.x - g.x) * k;
        g.y += (s.pinch.y - g.y) * k;
        if (!cursorSide || side === holder.current) cursorSide = side;
      }
    }

    if (holder.current && drag.carrying) {
      const g = glide.current[holder.current];
      if (g) {
        const p = hitLevel(
          g.x - offset.current.x,
          g.y - offset.current.y,
          LIFT,
          hit,
        );
        if (p) carryTo(p.x, p.z);
      }
    } else if (holder.current && !drag.carrying) {
      holder.current = null;
    }

    // The ring under the pinch: under the carried piece, or where the
    // pinch points on the board.
    const c = drag.cursor;
    c.visible = false;
    if (orbit.active || !cursorSide || game.phase === "setup") return;
    if (holder.current && drag.carrying) {
      c.visible = true;
      c.x = drag.pos.x;
      c.z = drag.pos.z;
      c.pinched = true;
      return;
    }
    const g = glide.current[cursorSide];
    if (!g) return;
    const p = hitLevel(g.x, g.y, 0, hit);
    if (p && Math.abs(p.x) < 4.3 && Math.abs(p.z) < 4.3) {
      c.visible = true;
      c.x = p.x;
      c.z = p.z;
      c.pinched = hands[cursorSide].pinched;
    }
  });

  return <HandTracker targetFps={HAND_FPS} />;
};
