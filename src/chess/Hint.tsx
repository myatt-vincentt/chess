// The only hint, wordless, small and low in the middle: see-through ghost
// hands (the SDK's hand hint) taking turns to show the two hand controls.
//   1. one hand pinches and carries a little way down: pinch to move
//   2. two open palms, the left still, the right sweeping: orbit
// It goes for good after the first move made by hand.
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group, PerspectiveCamera } from "three";
import { defineGltfAsset, useXRAsset } from "@vincentt-xr/sdk";
import { HandGestureHint } from "@vincentt-xr/sdk/instructions";

import { reserved } from "./fit";
import { game } from "./game";

const handAsset = defineGltfAsset("/models/hand-v1.glb");

const HINT = {
  /** In front of the board (world z), so it is never hidden by it. */
  z: 2.4,
  /** Hand height (px on screen) and its centre above the controls (px). */
  heightPx: 64,
  abovePx: 46,
  /** Seconds per demonstration, and the fade in / out at each end. */
  phase: 2.8,
  fade: 0.3,
  delay: 1,
  renderOrder: 50,
};

const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
const NO_GLOW = { glow: false as const, halo: false as const };
/** Pinch: from relaxed into the pinch, then held while it carries. */
const PINCH_LOOP = {
  seconds: HINT.phase,
  hold: 0.55,
  from: 0,
  easing: easeOut,
};
/** Palms: held open the whole time. */
const PALM_LOOP = { seconds: HINT.phase, hold: 1, from: 1, easing: easeOut };

export const Hint = () => {
  const { value: hand } = useXRAsset(handAsset);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const root = useRef<Group>(null);
  const pinch = useRef<Group>(null);
  const palms = useRef<Group>(null);
  const mover = useRef<Group>(null);
  const t0 = useRef(-1);
  const gone = useRef(0);

  useFrame((state, dt) => {
    const r = root.current;
    if (!r || !pinch.current || !palms.current || !mover.current) return;
    const playing = game.phase === "play" && !game.result;
    const done = game.handMoves > 0;
    if (!playing) t0.current = -1;
    if (playing && t0.current < 0) t0.current = state.clock.elapsedTime;
    gone.current = done ? Math.min(1, gone.current + dt / HINT.fade) : 0;
    const visible = playing && !(done && gone.current >= 1);
    r.visible = visible;
    if (!visible) return;

    // Low in the middle, just above the controls, at its size in pixels.
    const depth = camera.position.z - HINT.z;
    const half = Math.tan(((camera.fov / 2) * Math.PI) / 180) * depth;
    const pxToWorld = (2 * half) / size.height;
    const yPx = size.height - reserved.bottom - HINT.abovePx;
    r.position.set(0, (size.height / 2 - yPx) * pxToWorld, HINT.z);
    r.scale.setScalar(HINT.heightPx * pxToWorld);

    const age = state.clock.elapsedTime - t0.current - HINT.delay;
    if (age < 0) {
      r.visible = false;
      return;
    }
    const cycle = age % (HINT.phase * 2);
    const showPinch = cycle < HINT.phase;
    const t = showPinch ? cycle : cycle - HINT.phase;
    const fade =
      Math.min(easeOut(t / HINT.fade), easeOut((HINT.phase - t) / HINT.fade)) *
      (1 - easeOut(gone.current));
    const s = Math.max(1e-4, fade);
    pinch.current.visible = showPinch;
    palms.current.visible = !showPinch;
    if (showPinch) {
      // After the pinch closes, it carries a little down and to the side.
      const carry = easeOut((t / HINT.phase - 0.45) / 0.4);
      pinch.current.position.set(0.35 * carry, -0.35 * carry, 0);
      pinch.current.scale.setScalar(s);
    } else {
      palms.current.scale.setScalar(s);
      // The right palm sweeps across and back; the left stays still.
      mover.current.position.x =
        0.62 + 0.38 * Math.sin((t / HINT.phase) * Math.PI * 2);
    }
  });

  if (!hand) return null;
  return (
    <group ref={root} visible={false}>
      <group ref={pinch}>
        <HandGestureHint
          gesture="ok"
          model={hand.scene}
          poses={hand.animations}
          height={1}
          loop={PINCH_LOOP}
          look={NO_GLOW}
          orbit={0}
          renderOrder={HINT.renderOrder}
        />
      </group>
      <group ref={palms}>
        <group position={[-0.62, 0, 0]}>
          <HandGestureHint
            gesture="palm"
            showHand="left"
            model={hand.scene}
            poses={hand.animations}
            height={1}
            loop={PALM_LOOP}
            look={NO_GLOW}
            orbit={0}
            renderOrder={HINT.renderOrder}
          />
        </group>
        <group ref={mover}>
          <HandGestureHint
            gesture="palm"
            model={hand.scene}
            poses={hand.animations}
            height={1}
            loop={PALM_LOOP}
            look={NO_GLOW}
            orbit={0}
            renderOrder={HINT.renderOrder}
          />
        </group>
      </group>
    </group>
  );
};
