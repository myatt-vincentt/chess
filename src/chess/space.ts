// Board space. On the board a square is 1 wide; a1 is at the near left for
// white, files run along +x and ranks along −z, and the playing surface is
// y = 0. These helpers turn squares into board points and screen points (CSS
// pixels on the canvas) into rays across the board, through the board's live
// placement (its turn, tilt, size and position).
import { Matrix4, Plane, Raycaster, Vector2, Vector3 } from "three";
import type { Camera, Object3D, Ray } from "three";

import { fileOf, rankOf, squareAt } from "./roster";
import type { Square } from "./roster";

export const space = {
  /** The group whose local frame is board space. */
  board: null as Object3D | null,
  camera: null as Camera | null,
  /** Canvas size (CSS px) and its offset in the page. */
  width: 1,
  height: 1,
  left: 0,
  top: 0,
};

export const squareToLocal = (sq: Square, y = 0, out = new Vector3()) =>
  out.set(fileOf(sq) - 3.5, y, 3.5 - rankOf(sq));

export const localToSquare = (x: number, z: number): Square | null =>
  squareAt(Math.floor(x + 4), Math.floor(4 - z));

const raycaster = new Raycaster();
const ndc = new Vector2();
const inverse = new Matrix4();
const plane = new Plane(new Vector3(0, 1, 0), 0);
const tmp = new Vector3();

/** The ray under canvas point (x, y), in world space (null before first frame). */
export const worldRay = (x: number, y: number): Ray | null => {
  if (!space.camera) return null;
  ndc.set((x / space.width) * 2 - 1, -(y / space.height) * 2 + 1);
  raycaster.setFromCamera(ndc, space.camera);
  return raycaster.ray;
};

/** The ray under canvas point (x, y), in board space. */
export const boardRay = (x: number, y: number): Ray | null => {
  const ray = worldRay(x, y);
  if (!ray || !space.board) return null;
  inverse.copy(space.board.matrixWorld).invert();
  return ray.clone().applyMatrix4(inverse);
};

/** Where the ray under (x, y) meets the level `height` above the board. */
export const hitLevel = (
  x: number,
  y: number,
  height: number,
  out = new Vector3(),
) => {
  const ray = boardRay(x, y);
  if (!ray) return null;
  plane.constant = -height;
  return ray.intersectPlane(plane, out);
};

/** A board point → canvas point (CSS px); z is the projected depth. */
export const localToCanvas = (p: Vector3, out = new Vector3()) => {
  if (!space.board || !space.camera) return out.set(-1e4, -1e4, 2);
  tmp.copy(p);
  space.board.localToWorld(tmp);
  tmp.project(space.camera);
  return out.set(
    ((tmp.x + 1) / 2) * space.width,
    ((1 - tmp.y) / 2) * space.height,
    tmp.z,
  );
};

/** How wide one square looks on screen near `sq` (px). */
export const squarePixels = (sq: Square = "e4") => {
  const a = localToCanvas(
    squareToLocal(sq, 0, new Vector3()).add(new Vector3(-0.5, 0, 0)),
  );
  const b = localToCanvas(
    squareToLocal(sq, 0, new Vector3()).add(new Vector3(0.5, 0, 0)),
  );
  return Math.hypot(a.x - b.x, a.y - b.y);
};

/** A page (client) point → canvas point. */
export const clientToCanvas = (clientX: number, clientY: number) => ({
  x: clientX - space.left,
  y: clientY - space.top,
});
