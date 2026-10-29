# Chess

Play the computer on a glossy 3D chess board floating in front of you, over your camera picture.
Pick your colour (white, black or either) and the computer's strength, from Beginner 800 to Master
2600, with an optional clock (5 min, 10 min or 3+2). The picture fills the whole screen.

- Thumbnail: `public/images/chess-thumbnail.jpg` (the share image).
- **By hand.** Pinch (thumb to index) on or near one of your pieces to pick it up: it lifts and
  follows your pinch, with a glowing ring under it and its squares lit. Open the pinch over a lit
  square to put it there; anywhere else it eases back. Two open palms orbit the board: keep one
  still and move the other (left / right turns it, up / down tilts it). A wordless ghost-hand hint
  shows both until your first move by hand.
- **Mouse or touch.** Drag a piece to a lit square, or tap the piece and then the square. Drag
  anywhere else to orbit; the wheel or a two-finger pinch zooms; a double-click or double-tap off
  the board puts the view back.
- **Extras.** Undo (your move and the reply), hint (the best move, lit for a moment), new game,
  clock, sound (wooden click, capture thud, check chime, mate fanfare, made in code; on after
  Play). The captured pieces fly to trays beside the board; the top panel shows the ratings, the
  pieces taken, the clocks and the last moves; the computer's dot pulses while it thinks.
- **Levels.** Beginner 800 and Casual 1100 use Stockfish's Skill Level with a shallow search and an
  occasional loose move; Club 1400, Strong 1800, Expert 2200 and Master 2600 use `UCI_Elo`. The
  numbers are approximate. Presets live in `src/chess/levels.ts`.
- **Licence.** This template is GPL-3.0 (see `LICENSE`) because it bundles the Stockfish chess
  engine (GPL-3.0), served from `public/engine/` (Stockfish.js 19 "lite single-threaded" build,
  source: https://github.com/nmrugg/stockfish.js and https://github.com/official-stockfish/Stockfish).
  Rules by chess.js (BSD-2-Clause). Credits in `CREDITS.md`.
- Code: `src/chess/` — the game and engine (`game.ts`, `engine.ts`, `levels.ts`, `roster.ts`,
  `clock.sim.ts`), the board and pieces turned in code (`Board.tsx`, `pieces.ts`, `look.ts`),
  input (`PointerInput.tsx`, `HandInput.tsx` with `hands.sim.ts`, `drag.ts`), the controls
  (`Hud.tsx`), the hint (`Hint.tsx`, using `public/models/hand-v1.glb`) and sounds (`audio.ts`).
- `src/App.tsx` uses a full-window container instead of the 9:16 frame; re-apply after a template
  upgrade.
- Dev preview without a camera: the media switcher starts on the SDK's sample video (or
  `dev-media/chess.mp4`); the board plays with the mouse on any source. In development
  `window.__chess` shows the game state, the engine's UCI commands and think times, square
  positions on screen, and has scripted hands (`__chess.hands`). How it works: `PLAN.md`.

---

# v2-template

The Vincentt starter app: a real React + R3F + Vincentt XR SDK (`@vincentt-xr/sdk`)
WebXR app, bundled by esbuild.

## Shape

```
src/
  main.tsx            mount — never edited
  App.tsx             protected shell: XRProvider + AspectRatioContainer +
                      XRScene + media-source binding, camera, lighting,
                      VideoBackground, PreviewAnchors — never edited
  Scene.tsx           the agent's surface: add SDK components and R3F
                      primitives here
  PreviewAnchors.tsx  editor-preview integration — never edited
```

See `AGENTS.md` and `GROUNDING.md` for the API reference and how to author scenes.

## Develop

```
pnpm install
pnpm dev          # esbuild dev server on localhost:5173 (output in .dev/)
pnpm preview      # on-device preview over a secure tunnel (needs `vincentt login`)
pnpm typecheck
pnpm build        # production bundle to dist/
```

## Release

`vincentt init` scaffolds from the **`latest` tag**, not from `main`. Merging to `main` does
not ship a template to creators — cutting a release does.

```
git tag 1.1.0 <sha>      # bare semver, no `v` prefix
git push origin 1.1.0    # the Release workflow verifies the tag, then moves `latest`
```

The Release workflow (`.github/workflows/release.yml`) installs from the frozen lockfile,
builds, and typechecks **the tagged tree** before force-updating `latest` to it. A tag that
fails leaves `latest` where it was, so a broken release cannot reach a new creator.

The job runs in the `release` environment, which accepts bare-semver tags only. To re-run it by
hand, dispatch it from the tag itself ("Use workflow from: 1.1.0"); a dispatch from `main` is
refused.

**Never move `latest` by hand.** It is force-updated by that workflow and nowhere else; moving
it manually decouples the pointer from the version it claims to be.

Creators can pin a specific version — `vincentt init --template 1.0.0` — which is the escape
hatch when a release turns out to be bad. That is why the version tags are immutable and only
`latest` moves.

### `MIGRATION.md` and the platform release row

Root `MIGRATION.md` carries one entry per released tag, newest first, authored in the same
PR as the change: `required: true|false`, a one-line summary, and optional notes bullets.
`required: false` means no consumer action is needed, never that the entry was skipped. The
Release workflow refuses to move `latest` for a tag with no valid entry, then — once `latest`
has moved — posts that entry as this release's row to the platform (`POST
/platform/releases`, component `template`), via `scripts/release-row.mjs`. Both steps read
`MIGRATION.md` from `main`, not from the tagged tree: the note is reviewed via PR into `main`
and is append-only per version, so `main`'s copy is the reviewed source for any tag, including
one cut before this file existed. That row is what `vincentt outdated` reads back to tell a
creator's agent what changed and what to do about it.
