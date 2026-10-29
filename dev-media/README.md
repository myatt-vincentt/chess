# dev-media

Optional dev-only preview media. Nothing here ships: only
`src/DevMediaSwitcher.tsx` reads this folder, and it is stripped from
production builds.

You don't need anything here. Without a webcam, `pnpm dev` starts on the SDK's
built-in "Person Looking" video and lists every SDK sample video and image. The
board plays with the mouse or touch on any source.

To preview with your own clip (for example your hands over a desk), add it at
`dev-media/chess.mp4` (H.264 MP4); it is listed first and used as the start.
Clips here are git-ignored. Restart `pnpm dev` after adding or removing one.
