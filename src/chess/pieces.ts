// The chess pieces, turned in code: Staunton-style profiles spun on a lathe
// (pawn, rook, bishop, queen, king) and a knight whose horse head is a carved
// side profile, thickened through the neck and narrowed at the muzzle. Sizes
// are in squares (a square is 1 wide); every piece stands on y = 0.
import {
  BoxGeometry,
  BufferGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  SphereGeometry,
  SplineCurve,
  Vector2,
} from "three";
/* eslint-disable import/extensions */
import {
  mergeGeometries,
  toCreasedNormals,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";
/* eslint-enable import/extensions */

import type { PieceType } from "./roster";

type P = [number, number];

/** A circular arc of profile points (angles in degrees). */
const arc = (
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  n = 10,
): P[] => {
  const out: P[] = [];
  for (let i = 0; i <= n; i += 1) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push([Math.max(0, cx + r * Math.cos(a)), cy + r * Math.sin(a)]);
  }
  return out;
};

/** A smooth run through the given points. */
const spline = (pts: P[], n = 18): P[] =>
  new SplineCurve(pts.map(([x, y]) => new Vector2(x, y)))
    .getPoints(n)
    .map((v) => [v.x, v.y] as P);

/** The shared foot: a flat felt bottom, a rounded edge and a torus ring. */
const foot = (r: number): P[] => [
  [0, 0],
  [r - 0.02, 0],
  ...arc(r - 0.02, 0.02, 0.02, -90, 0, 4),
  [r, 0.06],
  ...arc(r - 0.035, 0.105, 0.035, -70, 80, 8),
  [r - 0.06, 0.15],
];

/** A collar ring: out to `r`, centred at `y`. */
const collar = (r: number, y: number, inner: number): P[] => [
  [inner, y - 0.035],
  ...arc(r - 0.025, y, 0.028, -90, 90, 8),
  [inner, y + 0.035],
];

const lathe = (pts: P[], segments = 48) =>
  new LatheGeometry(
    pts.map(([x, y]) => new Vector2(x, y)),
    segments,
  );

/** Same attributes everywhere (position + normal), non-indexed, for merging. */
const clean = (g: BufferGeometry) => {
  const n = g.index ? g.toNonIndexed() : g;
  n.deleteAttribute("uv");
  if (!n.getAttribute("normal")) n.computeVertexNormals();
  return n;
};

const merge = (parts: BufferGeometry[]) => {
  const merged = mergeGeometries(parts.map(clean));
  if (!merged) throw new Error("piece geometry did not merge");
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
};

const pawn = () =>
  merge([
    lathe([
      ...foot(0.3),
      ...spline([
        [0.24, 0.15],
        [0.19, 0.2],
        [0.145, 0.28],
        [0.115, 0.4],
        [0.105, 0.5],
      ]),
      ...collar(0.19, 0.53, 0.1),
      ...arc(0, 0.705, 0.155, -48, 90, 16),
    ]),
  ]);

const rook = () => {
  const body = lathe([
    ...foot(0.33),
    ...spline([
      [0.27, 0.15],
      [0.22, 0.2],
      [0.195, 0.3],
      [0.185, 0.5],
      [0.195, 0.66],
    ]),
    ...collar(0.25, 0.7, 0.2),
    [0.235, 0.74],
    [0.25, 0.8],
    [0.262, 0.95],
    ...arc(0.247, 0.965, 0.015, 0, 90, 3),
    [0.17, 0.98],
    [0.17, 0.9],
    [0, 0.9],
  ]);
  // Six battlements round the top.
  const merlons: BufferGeometry[] = [];
  for (let i = 0; i < 6; i += 1) {
    const a0 = (i / 6) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / 6 - 0.36;
    const s = new Shape();
    s.absarc(0, 0, 0.262, a0, a1, false);
    s.absarc(0, 0, 0.17, a1, a0, true);
    const g = new ExtrudeGeometry(s, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.008,
      bevelSegments: 2,
      curveSegments: 8,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.98, 0);
    merlons.push(g);
  }
  return merge([body, ...merlons]);
};

const bishop = () =>
  merge([
    lathe([
      ...foot(0.32),
      ...spline([
        [0.26, 0.15],
        [0.2, 0.2],
        [0.155, 0.3],
        [0.12, 0.5],
        [0.105, 0.68],
        [0.11, 0.76],
      ]),
      ...collar(0.2, 0.8, 0.11),
      ...spline(
        [
          [0.11, 0.835],
          [0.15, 0.9],
          [0.172, 0.99],
          [0.16, 1.09],
          [0.115, 1.18],
          [0.055, 1.235],
          [0.03, 1.26],
        ],
        22,
      ),
      ...arc(0, 1.3, 0.05, -50, 90, 10),
    ]),
  ]);

const queen = () => {
  const body = lathe([
    ...foot(0.35),
    ...spline([
      [0.29, 0.15],
      [0.22, 0.21],
      [0.165, 0.32],
      [0.125, 0.55],
      [0.11, 0.8],
      [0.115, 0.9],
    ]),
    ...collar(0.21, 0.94, 0.12),
    ...spline([
      [0.13, 0.975],
      [0.15, 1.07],
      [0.2, 1.2],
      [0.238, 1.31],
    ]),
    ...arc(0.225, 1.322, 0.016, -30, 120, 4),
    [0.16, 1.345],
    [0.105, 1.38],
    ...arc(0, 1.405, 0.1, 0, 90, 10),
  ]);
  // The coronet: a ring of small beads, and a ball on top.
  const beads: BufferGeometry[] = [];
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2;
    const b = new SphereGeometry(0.036, 12, 8);
    b.translate(Math.cos(a) * 0.215, 1.352, Math.sin(a) * 0.215);
    beads.push(b);
  }
  const top = new SphereGeometry(0.06, 20, 14);
  top.translate(0, 1.555, 0);
  return merge([body, ...beads, top]);
};

const king = () => {
  const body = lathe([
    ...foot(0.36),
    ...spline([
      [0.3, 0.15],
      [0.23, 0.21],
      [0.17, 0.33],
      [0.13, 0.6],
      [0.12, 0.92],
      [0.125, 1.0],
    ]),
    ...collar(0.22, 1.04, 0.125),
    ...spline([
      [0.14, 1.075],
      [0.16, 1.17],
      [0.21, 1.29],
      [0.232, 1.36],
    ]),
    ...arc(0.218, 1.372, 0.016, -30, 110, 4),
    [0.15, 1.41],
    [0.1, 1.45],
    [0.075, 1.5],
    [0, 1.51],
  ]);
  const upright = new BoxGeometry(0.07, 0.27, 0.07, 1, 1, 1);
  upright.translate(0, 1.62, 0);
  const arm = new BoxGeometry(0.2, 0.07, 0.07, 1, 1, 1);
  arm.translate(0, 1.66, 0);
  return merge([body, upright, arm]);
};

/** The knight's side profile (x = forward, y = up). */
const knightShape = () => {
  const s = new Shape();
  s.moveTo(-0.215, 0.27);
  s.lineTo(0.215, 0.27);
  s.splineThru(
    [
      [0.24, 0.36],
      [0.225, 0.48],
      [0.165, 0.58],
      [0.125, 0.635],
      [0.165, 0.68],
      [0.27, 0.715],
      [0.36, 0.76],
      [0.4, 0.83],
      [0.385, 0.895],
      [0.31, 0.94],
      [0.22, 1.0],
      [0.16, 1.09],
      [0.135, 1.17],
    ].map(([x, y]) => new Vector2(x, y)),
  );
  // The ear.
  s.lineTo(0.105, 1.29);
  s.lineTo(0.045, 1.2);
  s.splineThru(
    [
      [-0.03, 1.2],
      [-0.13, 1.12],
      [-0.205, 0.98],
      [-0.245, 0.8],
      [-0.255, 0.6],
      [-0.245, 0.42],
    ].map(([x, y]) => new Vector2(x, y)),
  );
  s.lineTo(-0.215, 0.27);
  return s;
};

const knight = () => {
  const head = new ExtrudeGeometry(knightShape(), {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.065,
    bevelSize: 0.04,
    bevelSegments: 6,
    curveSegments: 28,
  });
  head.translate(0, 0, -0.05);
  // Thicker through the neck, narrower towards the muzzle.
  const pos = head.getAttribute("position");
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const muzzle =
      Math.min(1, Math.max(0, (x - 0.05) / 0.32)) *
      Math.min(1, Math.max(0, (y - 0.62) / 0.12));
    const neck = 1 + 0.4 * Math.max(0, 1 - (y - 0.27) / 0.55);
    pos.setZ(i, pos.getZ(i) * neck * (1 - 0.42 * muzzle));
  }
  head.deleteAttribute("normal");
  head.deleteAttribute("uv");
  const smooth = toCreasedNormals(head, (55 * Math.PI) / 180);
  const pedestal = lathe([
    ...foot(0.33),
    ...spline([
      [0.27, 0.15],
      [0.235, 0.2],
      [0.225, 0.25],
      [0.24, 0.29],
    ]),
    [0.2, 0.31],
    [0, 0.31],
  ]);
  // Eyes: a small bead each side, catching the light.
  const eyes = [1, -1].map((side) => {
    const eye = new SphereGeometry(0.032, 12, 8);
    eye.scale(1, 0.8, 0.6);
    eye.translate(0.13, 1.02, side * 0.098);
    return eye;
  });
  return merge([pedestal, smooth, ...eyes]);
};

const BUILDERS: Record<PieceType, () => BufferGeometry> = {
  p: pawn,
  n: knight,
  b: bishop,
  r: rook,
  q: queen,
  k: king,
};

/** Heights (squares), for picking and the lift. */
export const PIECE_HEIGHT: Record<PieceType, number> = {
  p: 0.86,
  n: 1.29,
  b: 1.35,
  r: 1.07,
  q: 1.62,
  k: 1.7,
};

/** Foot radius (squares), for the soft shadow. */
export const PIECE_RADIUS: Record<PieceType, number> = {
  p: 0.3,
  n: 0.33,
  b: 0.32,
  r: 0.33,
  q: 0.35,
  k: 0.36,
};

let cache: Record<PieceType, BufferGeometry> | null = null;

/** One geometry per piece type, built once and shared. */
export const pieceGeometries = () => {
  if (!cache) {
    cache = Object.fromEntries(
      (Object.keys(BUILDERS) as PieceType[]).map((t) => [t, BUILDERS[t]()]),
    ) as Record<PieceType, BufferGeometry>;
  }
  return cache;
};
