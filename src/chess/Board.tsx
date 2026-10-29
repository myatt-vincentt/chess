// The board and its pieces. A move arcs the piece over to its square, a
// captured piece flies to its tray beside the board, an undo flies it back.
// A carried piece floats above the board; put down on a square it may not go
// to, it eases back. Lit on the board: the last move, the king in check,
// where a picked piece may go, the hint, and the hand's ring.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, PlaneGeometry, Vector3 } from "three";
import type { Group, Mesh, MeshBasicMaterial } from "three";

import { carriedId, drag } from "./drag";
import { game, useGame } from "./game";
import {
  ARLES,
  BOARD,
  boardMaterials,
  decal,
  glowTexture,
  pieceMaterials,
  ringTexture,
  shadowTexture,
  squareTexture,
  studioEnvironment,
} from "./look";
import { PIECE_HEIGHT, PIECE_RADIUS, pieceGeometries } from "./pieces";
import type { Piece, Square } from "./roster";
import { squareToLocal } from "./space";

/** Trays beside the board (board space). */
const TRAY = { x: 4.98, y: -0.1, start: 3.3, step: 0.46, scale: 0.5 };
const SHADOW_Y = 0.004;
const DECALS = 48;

const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

type Anim = {
  pos: Vector3;
  from: Vector3;
  to: Vector3;
  t0: number;
  dur: number;
  arc: number;
  scale: number;
  fromScale: number;
  toScale: number;
  /** It was just put down from the air: no extra arc. */
  released: boolean;
};

/** Where a piece rests: its square, or its place in a tray. */
const restOf = (p: Piece, out: Vector3) => {
  const promo = game.promotion;
  if (p.square && promo && p.square === promo.from) {
    return { pos: squareToLocal(promo.to, 0, out), scale: 1 };
  }
  if (p.square) return { pos: squareToLocal(p.square, 0, out), scale: 1 };
  // Taken pieces line up beside the capturer, starting near the capturer.
  const takenByWhite = p.color === "b";
  const side = takenByWhite ? 1 : -1;
  out.set(side * TRAY.x, TRAY.y, side * (TRAY.start - p.tray * TRAY.step));
  return { pos: out, scale: TRAY.scale };
};

/** Knights face across the board and a little towards the other side. */
const knightTurn = (p: Piece) => {
  if (p.color === "w") return p.facing > 0 ? 0.25 : Math.PI - 0.25;
  return p.facing > 0 ? -0.25 : Math.PI + 0.25;
};

/** Board-space meshes of every piece (for the mouse's ray). */
export const pieceMeshes = new Map<string, Mesh>();

export const Board = () => {
  useGame();
  const gl = useThree((s) => s.gl);
  const env = useMemo(() => studioEnvironment(gl), [gl]);
  const geos = useMemo(() => pieceGeometries(), []);
  const mats = useMemo(() => pieceMaterials(env), [env]);
  const boardMats = useMemo(() => boardMaterials(gl, env), [gl, env]);
  const textures = useMemo(
    () => ({
      glow: glowTexture(),
      square: squareTexture(),
      ring: ringTexture(),
      shadow: shadowTexture(),
    }),
    [],
  );
  // One shadow material per piece (each fades on its own).
  const shadowMats = useMemo(
    () =>
      new Map(
        game.roster.map((p) => [p.id, decal(textures.shadow, "#ffffff", 0.8)]),
      ),
    [textures],
  );
  const decalMats = useMemo(
    () =>
      Array.from({ length: DECALS }, () =>
        decal(textures.square, "#ffffff", 0),
      ),
    [textures],
  );
  const plane = useMemo(
    () => new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    [],
  );
  const boardSize = BOARD.half * 2 + BOARD.frame * 2;
  const boardGeo = useMemo(
    () => new BoxGeometry(boardSize, BOARD.thickness, boardSize),
    [boardSize],
  );
  const trayGeo = useMemo(() => new BoxGeometry(0.62, 0.1, 7.6), []);

  useEffect(
    () => () => {
      Object.values(textures).forEach((t) => t.dispose());
      decalMats.forEach((m) => m.dispose());
      shadowMats.forEach((m) => m.dispose());
      Object.values(mats).forEach((m) => m.dispose());
      boardMats.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
      plane.dispose();
      boardGeo.dispose();
      trayGeo.dispose();
    },
    [
      textures,
      decalMats,
      shadowMats,
      mats,
      boardMats,
      plane,
      boardGeo,
      trayGeo,
    ],
  );

  const anims = useRef(new Map<string, Anim>());
  const groups = useRef(new Map<string, Group>());
  const shadows = useRef(new Map<string, Mesh>());
  const decalRefs = useRef<Array<Mesh | null>>([]);
  const lastCarried = useRef<string | null>(null);
  const scratch = useMemo(() => new Vector3(), []);
  const carriedSmooth = useMemo(() => new Vector3(), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const now = state.clock.elapsedTime;
    const carried = carriedId();
    if (lastCarried.current && lastCarried.current !== carried) {
      const a = anims.current.get(lastCarried.current);
      if (a) a.released = true;
    }
    if (carried && carried !== lastCarried.current)
      carriedSmooth.copy(drag.pos);
    lastCarried.current = carried;

    game.roster.forEach((p) => {
      const g = groups.current.get(p.id);
      if (!g) return;
      const rest = restOf(p, scratch);
      let a = anims.current.get(p.id);
      if (!a) {
        a = {
          pos: rest.pos.clone(),
          from: rest.pos.clone(),
          to: rest.pos.clone(),
          t0: -1,
          dur: 0,
          arc: 0,
          scale: rest.scale,
          fromScale: rest.scale,
          toScale: rest.scale,
          released: false,
        };
        anims.current.set(p.id, a);
      }
      if (p.id === carried) {
        // In the air: follow the pointer or the pinch, eased against jitter.
        const k = 1 - Math.exp(-(drag.source === "hand" ? 22 : 40) * dt);
        carriedSmooth.lerp(drag.pos, k);
        a.pos.copy(carriedSmooth);
        a.from.copy(a.pos);
        a.to.copy(a.pos);
        a.t0 = -1;
        a.scale = 1;
      } else {
        if (
          a.to.distanceToSquared(rest.pos) > 1e-6 ||
          a.toScale !== rest.scale
        ) {
          const dist = a.pos.distanceTo(rest.pos);
          const toTray = rest.scale < 1 && a.scale >= 1;
          a.from.copy(a.pos);
          a.to.copy(rest.pos);
          a.fromScale = a.scale;
          a.toScale = rest.scale;
          // A capture leaves as the capturing piece lands.
          a.t0 = now + (toTray ? 0.2 : 0);
          if (a.released) {
            a.dur = 0.16 + Math.min(0.24, dist * 0.06);
            a.arc = 0;
          } else {
            a.dur = Math.min(0.7, 0.3 + dist * 0.045);
            a.arc =
              toTray || rest.scale !== a.fromScale ? 1.3 : 0.3 + dist * 0.07;
          }
          a.released = false;
        }
        if (a.t0 >= 0) {
          const t = Math.max(0, (now - a.t0) / Math.max(0.01, a.dur));
          const e = easeOut(t);
          a.pos.lerpVectors(a.from, a.to, e);
          a.pos.y += a.arc * Math.sin(Math.PI * Math.min(1, t));
          a.scale = a.fromScale + (a.toScale - a.fromScale) * e;
          if (t >= 1) {
            a.pos.copy(a.to);
            a.scale = a.toScale;
            a.t0 = -1;
          }
        }
      }
      g.position.copy(a.pos);
      g.scale.setScalar(a.scale);
      // The soft shadow stays on the board (or tray) and fades as it rises.
      const sh = shadows.current.get(p.id);
      if (sh) {
        const onTray = Math.abs(a.pos.x) > 4.6;
        const floor = onTray ? TRAY.y + 0.051 : SHADOW_Y;
        const lift = Math.max(0, a.pos.y - (onTray ? TRAY.y : 0));
        const r = PIECE_RADIUS[p.type] * a.scale * 2.9 * (1 + lift * 0.35);
        sh.position.set(a.pos.x, floor, a.pos.z);
        sh.scale.set(r, 1, r);
        (sh.material as MeshBasicMaterial).opacity = 0.8 / (1 + lift * 1.8);
      }
    });

    // Highlights.
    let n = 0;
    const put = (
      sq: Square | null,
      map: "square" | "glow" | "ring",
      color: string,
      opacity: number,
      size = 1,
      at?: { x: number; z: number },
    ) => {
      if ((!sq && !at) || n >= DECALS) return;
      const mesh = decalRefs.current[n];
      n += 1;
      if (!mesh) return;
      const m = mesh.material as MeshBasicMaterial;
      if (m.map !== textures[map]) {
        m.map = textures[map];
        m.needsUpdate = true;
      }
      m.color.set(color);
      m.opacity = opacity;
      if (at) mesh.position.set(at.x, 0.006 + n * 0.0004, at.z);
      else if (sq) squareToLocal(sq, 0.006 + n * 0.0004, mesh.position);
      mesh.scale.set(size, 1, size);
      mesh.visible = true;
    };
    const lm = game.lastMove;
    if (lm) {
      put(lm.from, "square", ARLES, 0.26);
      put(lm.to, "square", ARLES, 0.36);
    }
    if (game.checkSquare) {
      const pulse = 0.75 + 0.25 * Math.sin(now * 5);
      put(game.checkSquare, "glow", "#ff3b2f", 0.7 * pulse, 1.35);
    }
    if (game.hint) {
      const pulse = 0.6 + 0.4 * Math.sin(now * 6);
      put(game.hint.from, "square", "#7ff0cf", 0.55 * pulse);
      put(game.hint.to, "square", "#7ff0cf", 0.7 * pulse);
    }
    if (drag.selected) {
      put(drag.selected, "square", ARLES, 0.5);
      const occupied = new Set(
        game.roster.filter((p) => p.square).map((p) => p.square as Square),
      );
      drag.targets.forEach((sq) => {
        if (occupied.has(sq)) put(sq, "ring", ARLES, 0.95, 1.05);
        else put(sq, "glow", ARLES, 0.85, 0.34);
      });
      if (drag.carrying && drag.hover && drag.hover !== drag.selected) {
        const ok = drag.targets.includes(drag.hover);
        put(drag.hover, "square", ok ? ARLES : "#ffffff", ok ? 0.5 : 0.14);
      }
    }
    // The hand's ring: a thin ring, a little brighter while pinching.
    const c = drag.cursor;
    if (c.visible) {
      put(
        null,
        "ring",
        ARLES,
        c.pinched ? 0.95 : 0.6,
        c.pinched ? 0.62 : 0.74,
        c,
      );
    }
    for (let i = n; i < DECALS; i += 1) {
      const mesh = decalRefs.current[i];
      if (mesh) mesh.visible = false;
    }
  });

  return (
    <group>
      <mesh
        geometry={boardGeo}
        material={boardMats}
        position={[0, -BOARD.thickness / 2, 0]}
      />
      {[1, -1].map((side) => (
        <mesh
          key={side}
          geometry={trayGeo}
          material={boardMats[0]}
          position={[side * TRAY.x, TRAY.y - 0.05, 0]}
        />
      ))}
      {decalMats.map((m, i) => (
        <mesh
          // eslint-disable-next-line react/no-array-index-key -- a fixed pool
          key={i}
          ref={(el) => {
            decalRefs.current[i] = el;
          }}
          geometry={plane}
          material={m}
          visible={false}
          renderOrder={2}
        />
      ))}
      {game.roster.map((p) => (
        <group key={p.id}>
          <mesh
            ref={(el) => {
              if (el) shadows.current.set(p.id, el);
              else shadows.current.delete(p.id);
            }}
            geometry={plane}
            material={shadowMats.get(p.id)}
            renderOrder={1}
          />
          <group
            ref={(el) => {
              if (el) groups.current.set(p.id, el);
              else groups.current.delete(p.id);
            }}
          >
            <mesh
              ref={(el) => {
                if (el) pieceMeshes.set(p.id, el);
                else pieceMeshes.delete(p.id);
              }}
              geometry={geos[p.type]}
              material={mats[p.color]}
              rotation={[0, p.type === "n" ? knightTurn(p) : 0, 0]}
              userData={{ pieceId: p.id, height: PIECE_HEIGHT[p.type] }}
            />
          </group>
        </group>
      ))}
    </group>
  );
};
