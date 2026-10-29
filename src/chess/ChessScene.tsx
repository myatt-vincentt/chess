// Chess: a glossy 3D board floating in front of you over the camera picture.
// Play the computer (Stockfish) with the mouse, a finger or your hands: pinch
// a piece to carry it, two open palms to orbit the board.
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group, PerspectiveCamera } from "three";

import { Board } from "./Board";
import { fitBoard, reserved } from "./fit";
import { HandInput } from "./HandInput";
import { Hint } from "./Hint";
import { Hud } from "./Hud";
import { PointerInput } from "./PointerInput";
import { space } from "./space";
import { stepView, view } from "./view";

/** How fast the board settles into a new fitted size (1/s). */
const FIT_RATE = 6;

/** Places the board: fitted to the screen, then turned, tilted and zoomed. */
const BoardRig = () => {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const outer = useRef<Group>(null);
  const tilt = useRef<Group>(null);
  const turn = useRef<Group>(null);
  const fit = useRef({ key: "", scale: 0, y: 0, nowScale: 0, nowY: 0 });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    stepView(dt);
    space.camera = camera;
    space.width = size.width;
    space.height = size.height;
    space.board = turn.current;
    const f = fit.current;
    const key = `${size.width}x${size.height}:${Math.round(reserved.top)}:${Math.round(
      reserved.bottom,
    )}:${view.baseTurn}`;
    if (key !== f.key) {
      f.key = key;
      const next = fitBoard(camera, size.width, size.height, view.baseTurn);
      f.scale = next.scale;
      f.y = next.y;
      if (f.nowScale === 0) {
        f.nowScale = f.scale;
        f.nowY = f.y;
      }
    }
    const k = 1 - Math.exp(-FIT_RATE * dt);
    f.nowScale += (f.scale - f.nowScale) * k;
    f.nowY += (f.y - f.nowY) * k;
    if (outer.current && tilt.current && turn.current) {
      outer.current.position.set(0, f.nowY, 0);
      outer.current.scale.setScalar(f.nowScale * view.now.zoom);
      tilt.current.rotation.x = view.now.tilt;
      turn.current.rotation.y = view.now.turn;
      outer.current.updateMatrixWorld();
    }
  }, -1);

  return (
    <group ref={outer}>
      <group ref={tilt}>
        <group ref={turn}>
          <Board />
        </group>
      </group>
    </group>
  );
};

export const ChessScene = () => (
  <>
    {/* Studio light: a soft key from the upper left, a cool fill from the
        right and a faint rim from behind the board. */}
    <directionalLight position={[-3, 5, 6]} intensity={0.45} />
    <directionalLight position={[4, 2, 3]} intensity={0.18} color="#dfe8ff" />
    <directionalLight position={[0, 4, -6]} intensity={0.3} color="#fff4e0" />
    <BoardRig />
    <PointerInput />
    <HandInput />
    <Hint />
    <Hud />
  </>
);
