// Development only: a `window.__chess` handle for scripted checks (where each
// square is on screen, the game state, the engine's commands and think times,
// scripted hands). Never reaches production (Scene.tsx loads it behind a
// NODE_ENV check).
import { useEffect } from "react";
import { Vector3 } from "three";

import { drag } from "./drag";
import { engineLog } from "./engine";
import {
  devChess,
  devPlay,
  game,
  newGame,
  requestHint,
  startGame,
  undo,
  updateSettings,
} from "./game";
import type { Settings } from "./game";
import { devHands, handDebug } from "./HandInput";
import { PIECE_HEIGHT } from "./pieces";
import { localToCanvas, space, squareToLocal } from "./space";
import type { Square } from "./roster";
import { resetView, view } from "./view";

const DevHooks = () => {
  useEffect(() => {
    const toClient = (sq: Square, h: number) => {
      const c = localToCanvas(squareToLocal(sq, h, new Vector3()));
      return { x: c.x + space.left, y: c.y + space.top };
    };
    const w = window as unknown as { __chess?: unknown };
    w.__chess = {
      state: () => ({
        phase: game.phase,
        fen: devChess().fen(),
        turn: devChess().turn(),
        userColor: game.userColor,
        thinking: game.thinking,
        hinting: game.hinting,
        hint: game.hint,
        result: game.result,
        sans: [...game.sans],
        lastMove: game.lastMove,
        check: game.checkSquare,
        promotion: game.promotion,
        handMoves: game.handMoves,
        clock: game.clock
          ? { ...game.clock, left: { ...game.clock.left } }
          : null,
        drag: {
          selected: drag.selected,
          carrying: drag.carrying,
          hover: drag.hover,
          targets: [...drag.targets],
          cursor: { ...drag.cursor },
        },
        captured: game.roster.filter((p) => !p.square).map((p) => p.id),
      }),
      /** Page point of a square's centre, at a height above the board. */
      squareClient: (sq: Square, h = 0) => toClient(sq, h),
      /** Page point of the middle of the piece standing on `sq`. */
      pieceClient: (sq: Square) => {
        const piece = devChess().get(sq);
        return toClient(sq, piece ? PIECE_HEIGHT[piece.type] * 0.4 : 0.3);
      },
      legal: () =>
        devChess()
          .moves({ verbose: true })
          .map((m) => ({ from: m.from, to: m.to, promotion: m.promotion })),
      settings: (s: Partial<Settings>) => updateSettings(s),
      start: startGame,
      newGame,
      undo,
      hint: () => void requestHint(),
      engine: engineLog,
      hands: devHands,
      handDebug: () => ({
        left: handDebug.hands ? { ...handDebug.hands.left } : null,
        right: handDebug.hands ? { ...handDebug.hands.right } : null,
        orbit: handDebug.orbit ? { ...handDebug.orbit } : null,
        pinches: handDebug.pinches,
        releases: handDebug.releases,
      }),
      view,
      resetView,
      /** Set both clocks (ms), e.g. to see a flag fall. */
      setClock: (ms: number) => {
        if (game.clock) {
          game.clock.left.w = ms;
          game.clock.left.b = ms;
        }
      },
      /** Play a move for whichever side is to move (stops the engine). */
      force: (from: string, to: string, promotion?: string) =>
        devPlay(from, to, promotion),
    };
    return () => {
      delete w.__chess;
    };
  }, []);
  return null;
};

export default DevHooks;
