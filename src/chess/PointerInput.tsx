// Playing with the mouse or a finger.
//
// Drag one of your pieces onto a lit square, or tap it and then tap the
// square. Drag anywhere else to orbit the board (left / right turns it, up /
// down tilts it). The wheel or a two-finger pinch zooms; a double-click or
// double-tap off the board puts the view back.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Raycaster, Vector2, Vector3 } from "three";

import { pieceMeshes } from "./Board";
import { LIFT, carryTo, drag, drop, pickUp, select, tapSquare } from "./drag";
import { canPick, game } from "./game";
import {
  clientToCanvas,
  hitLevel,
  localToCanvas,
  localToSquare,
  space,
  squareToLocal,
} from "./space";
import type { Square } from "./roster";
import { orbitBy, resetView, zoomBy } from "./view";

/** Movement before a press becomes a drag (px). */
const DRAG_START = 6;
/** Board turn / tilt for a drag across the whole canvas (radians). */
const TURN_PER_WIDTH = 3.4;
const TILT_PER_HEIGHT = 2.2;
/** Two taps within this long (ms) and this far (px) are a double-tap. */
const DOUBLE_MS = 320;
const DOUBLE_PX = 30;

type Mode = "none" | "piece" | "square" | "empty" | "carry" | "orbit" | "pinch";

const raycaster = new Raycaster();
const ndc = new Vector2();

/** The piece under canvas point (x, y), by its shape on screen. */
const pieceUnder = (x: number, y: number): Square | null => {
  if (!space.camera) return null;
  ndc.set((x / space.width) * 2 - 1, -(y / space.height) * 2 + 1);
  raycaster.setFromCamera(ndc, space.camera);
  const hits = raycaster.intersectObjects([...pieceMeshes.values()], false);
  for (let i = 0; i < hits.length; i += 1) {
    const id = hits[i].object.userData.pieceId as string | undefined;
    const piece = game.roster.find((p) => p.id === id);
    if (piece?.square) return piece.square;
  }
  return null;
};

/** The square under canvas point (x, y), or null off the board. */
const squareUnder = (x: number, y: number): Square | null => {
  const p = hitLevel(x, y, 0);
  return p ? localToSquare(p.x, p.z) : null;
};

export const PointerInput = () => {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none";
    const pointers = new Map<number, { x: number; y: number }>();
    let mode: Mode = "none";
    let start = { x: 0, y: 0 };
    let last = { x: 0, y: 0 };
    let pressed: Square | null = null;
    let offset = { x: 0, y: 0 };
    let pinchDist = 0;
    let lastTap = { t: 0, x: 0, y: 0 };
    const base = new Vector3();
    const at = new Vector3();

    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      space.left = r.left;
      space.top = r.top;
      return clientToCanvas(e.clientX, e.clientY);
    };

    const pinchSpan = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const p = local(e);
      pointers.set(e.pointerId, p);
      el.setPointerCapture?.(e.pointerId);
      if (pointers.size === 2) {
        // A second finger: zoom, and put any carried piece back.
        if (mode === "carry") {
          drag.hover = null;
          drop(false);
        }
        mode = "pinch";
        pinchDist = pinchSpan();
        return;
      }
      if (pointers.size > 2) return;
      start = p;
      last = p;
      const piece = pieceUnder(p.x, p.y);
      if (piece && canPick(piece)) {
        mode = "piece";
        pressed = piece;
        squareToLocal(piece, LIFT, base);
        const c = localToCanvas(base);
        offset = { x: p.x - c.x, y: p.y - c.y };
      } else {
        const sq = piece ?? squareUnder(p.x, p.y);
        mode = sq ? "square" : "empty";
        pressed = sq;
      }
    };

    const onMove = (e: PointerEvent) => {
      const p = local(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
      if (mode === "none") {
        if (e.pointerType === "mouse") {
          const piece = pieceUnder(p.x, p.y);
          el.style.cursor = piece && canPick(piece) ? "grab" : "";
        }
        return;
      }
      if (mode === "pinch") {
        if (pointers.size >= 2) {
          const d = pinchSpan();
          if (pinchDist > 0) zoomBy(d / pinchDist);
          pinchDist = d;
        }
        return;
      }
      const moved = Math.hypot(p.x - start.x, p.y - start.y) > DRAG_START;
      if (mode === "piece" && moved && pressed) {
        if (pickUp(pressed, "pointer")) {
          mode = "carry";
          el.style.cursor = "grabbing";
        } else mode = "orbit";
      } else if ((mode === "square" || mode === "empty") && moved) {
        mode = "orbit";
      }
      if (mode === "carry") {
        const hit = hitLevel(p.x - offset.x, p.y - offset.y, LIFT, at);
        if (hit) carryTo(hit.x, hit.z);
      } else if (mode === "orbit") {
        orbitBy(
          ((p.x - last.x) / space.width) * TURN_PER_WIDTH,
          ((p.y - last.y) / space.height) * TILT_PER_HEIGHT,
        );
      }
      last = p;
    };

    const onUp = (e: PointerEvent) => {
      const p = local(e);
      pointers.delete(e.pointerId);
      el.releasePointerCapture?.(e.pointerId);
      if (mode === "pinch") {
        if (pointers.size === 0) mode = "none";
        return;
      }
      if (mode === "carry") {
        drop(true);
      } else if (mode === "piece" || mode === "square") {
        tapSquare(pressed, "pointer");
      } else if (mode === "empty") {
        const double =
          performance.now() - lastTap.t < DOUBLE_MS &&
          Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < DOUBLE_PX;
        if (double) {
          resetView();
          lastTap = { t: 0, x: 0, y: 0 };
        } else {
          lastTap = { t: performance.now(), x: p.x, y: p.y };
        }
        select(null);
      }
      mode = "none";
      pressed = null;
      el.style.cursor = "";
    };

    const onCancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (mode === "carry") {
        drag.hover = null;
        drop(false);
      }
      if (pointers.size === 0) mode = "none";
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.0012));
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  return null;
};
