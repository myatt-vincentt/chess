# Plan

Chess: play the computer on a glossy 3D board floating in front of you, over the camera picture,
with the mouse, a finger or your hands.

## How it works

- **Board in front of you.** The board, its trays and the tallest pieces are fitted between the
  top panel and the bottom controls at a 50° tilt (`fit.ts`), then turned, tilted and zoomed by
  the view (`view.ts`, eased, strict ease-out). Your side is always nearest you.
- **Pieces turned in code.** Staunton-style lathe profiles for pawn, rook (with battlements),
  bishop, queen (with a bead coronet) and king (with a cross); the knight is a carved horse-head
  profile, thicker through the neck and narrower at the muzzle, with eyes (`pieces.ts`). Glossy
  ivory and black lacquer, a satin maple-and-walnut board with a thin frame and faint
  coordinates on all four sides, a soft shadow under each piece (`look.ts`).
- **Lighting.** A small studio reflection map, a soft key, a cool fill and a faint rim. The scene
  renders without tone mapping (the camera picture stays true), so the board and pieces roll off
  their own highlights (PBR Neutral in their shaders): glints stay small, ivory keeps its shading
  and the board never glares at any angle.
- **The game.** chess.js holds the rules (legal moves, check, mate, stalemate, repetition, the
  50-move rule, insufficient material, castling, en passant, promotion); the roster keeps each
  piece's identity so moves, captures and undos animate the right piece (`game.ts`,
  `roster.ts`). A move arcs the piece to its square; a capture flies to the capturer's tray as
  the mover lands.
- **The computer.** Stockfish (lite, single-threaded WebAssembly) runs in its own Web Worker,
  so the board never waits. Each search sets its level first (`levels.ts`): Skill Level with a
  shallow depth and an occasional loose move below Stockfish's 1320 floor, `UCI_LimitStrength` +
  `UCI_Elo` above it, each with its own think time. A reply never lands sooner than 0.55 s. If the
  engine can't load, the computer still plays (random legal moves, captures first).
- **Hint.** Full strength, 1.2 s; the two squares pulse mint for about 3 s.
- **Mouse and touch** (`PointerInput.tsx`). Press a piece and drag it (it floats above the board
  and keeps its grip offset), or tap the piece then the square. Drag elsewhere to orbit, wheel or
  two-finger pinch to zoom, double-click / double-tap off the board to reset.
- **Hands** (`HandInput.tsx`, `hands.sim.ts`). The hand model runs at 20 Hz; the pinch point
  glides between readings. Pinch is measured on the hand's 3D joints in palm lengths (closes
  below 0.3, opens above 0.45). A pinch picks the nearest of your pieces within ¾ of a square on
  screen (aiming at the piece's middle), or the piece on the square under it. The carried piece
  follows the ray through the pinch onto a level just above the board. An open palm needs the
  four fingers straight and the thumb well away from the index, two readings in a row, so a pinch
  is never a palm. Orbit: both palms open, one still (below 1.1 palm sizes/s) and the other
  moving (above 1.7); a dead zone and smoothed speeds keep it calm; anything else stops it.
- **Controls** (`Hud.tsx`), Night glass, never over the middle of the board: the setup sheet
  (colour, level chips, clock, Play); the top panel (ratings, pieces taken with the lead in
  points, clocks, last three moves); the bottom band (undo, hint, new game, clock, sound); the
  promotion chooser (mouse and touch; by hand a pawn becomes a queen); the result card.
- **Hint for hands** (`Hint.tsx`). Wordless SDK ghost hands, small, low in the middle: a pinch
  that carries, then two palms with one sweeping. Gone after the first move by hand.
- **Sound** (`audio.ts`). Synthesised: a wooden click, a capture thud, a check chime, a mate
  fanfare. On from the Play tap; the speaker button turns it off.
- **Full screen.** `src/App.tsx` swaps the 9:16 frame for a full-window container.
