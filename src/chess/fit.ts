// Sizing the board to the screen. The board, its trays and the tallest pieces
// are fitted between the top panel and the bottom controls, with a margin at
// the sides, at the default angle. Zoom then scales from there.
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { PerspectiveCamera } from "three";

import { VIEW } from "./view";

/** Space the panels take (CSS px), published by the controls. */
export const reserved = { top: 112, bottom: 132, side: 16 };

/** The board's extent in board space: board, trays and tall pieces. */
const EXTENT = { x: 5.25, z: 4.5, low: -0.25, high: 1.7 };

const corners = [-1, 1].flatMap((sx) =>
  [-1, 1].flatMap((sz) =>
    [EXTENT.low, EXTENT.high].map(
      (y) => new Vector3(sx * EXTENT.x, y, sz * EXTENT.z),
    ),
  ),
);

const m = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const s3 = new Vector3();
const p3 = new Vector3();
const v = new Vector3();

/**
 * The board's scale and height (world units) that fit it on screen at the
 * default angle. `turn` is the player's side (0 or π).
 */
export const fitBoard = (
  camera: PerspectiveCamera,
  width: number,
  height: number,
  turn: number,
) => {
  camera.updateMatrixWorld();
  const top = 1 - (2 * reserved.top) / height;
  const bottom = -1 + (2 * reserved.bottom) / height;
  const side = 1 - (2 * reserved.side) / width;
  const halfWorld =
    Math.tan(((camera.fov / 2) * Math.PI) / 180) * camera.position.z;
  let scale = 0.25;
  let y = 0;
  for (let i = 0; i < 8; i += 1) {
    e.set(VIEW.tilt, 0, 0);
    q.setFromEuler(e);
    m.compose(p3.set(0, y, 0), q, s3.setScalar(scale));
    m.multiply(new Matrix4().makeRotationY(turn));
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    corners.forEach((c) => {
      v.copy(c).applyMatrix4(m).project(camera);
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
    });
    const k = Math.min(
      (2 * side) / (maxX - minX),
      (top - bottom) / (maxY - minY),
    );
    scale *= k;
    y += ((top + bottom) / 2 - (maxY + minY) / 2) * halfWorld;
  }
  return { scale, y };
};
