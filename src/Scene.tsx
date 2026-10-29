// Scene.tsx — Chess: play the computer on a glossy 3D board floating in front
// of you, with the mouse, a finger or your hands.
import { lazy, Suspense } from "react";

import { ChessScene } from "./chess/ChessScene";

// Dev-only helpers for previewing without a camera. Lazy and behind a
// constant esbuild folds to false in production. Two rules:
// `process.env.NODE_ENV`, not `import.meta.env.DEV` (vincentt-xr/v2-template#112);
// and write the check INSIDE the ternary — hoisted into a `const`, esbuild
// keeps the dead branch.
const DevMediaSwitcher =
  process.env.NODE_ENV !== "production"
    ? lazy(() => import("./DevMediaSwitcher"))
    : null;
const DevHooks =
  process.env.NODE_ENV !== "production"
    ? lazy(() => import("./chess/DevHooks"))
    : null;

export const Scene = () => (
  <>
    <ChessScene />
    {DevMediaSwitcher && DevHooks ? (
      <Suspense fallback={null}>
        <DevMediaSwitcher />
        <DevHooks />
      </Suspense>
    ) : null}
  </>
);
