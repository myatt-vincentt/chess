// Small line icons for the controls, and flat chess-piece glyphs for the
// colour choice, the taken pieces and the promotion chooser.
import type { ReactNode } from "react";

import type { Color, PieceType } from "./roster";

const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width={20}
    height={20}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const UndoIcon = () => (
  <Icon>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
);

export const HintIcon = () => (
  <Icon>
    <path d="M9 18h6" />
    <path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0 0 12 3Z" />
  </Icon>
);

export const NewIcon = () => (
  <Icon>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" />
    <path d="M21 3v6h-6" />
  </Icon>
);

export const ClockIcon = () => (
  <Icon>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2" />
    <path d="M10 2h4" />
  </Icon>
);

export const SoundIcon = ({ on }: { on: boolean }) => (
  <Icon>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    {on ? (
      <>
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </>
    ) : (
      <>
        <path d="m16 9 5 6" />
        <path d="m21 9-5 6" />
      </>
    )}
  </Icon>
);

const BASE =
  "M5.5 20h13a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5Z";

const SHAPES: Record<PieceType, string> = {
  p: "M12 3a3 3 0 0 1 1.9 5.3c1.1.4 1.9 1.1 1.9 1.9H8.2c0-.8.8-1.5 1.9-1.9A3 3 0 0 1 12 3Z M9.3 11h5.4c0 2.7.9 5 2.3 8H7c1.4-3 2.3-5.3 2.3-8Z",
  n: "M7 19c-.7-2.6-1-4.8-.6-7 .4-2.2 1.3-3.9 2.6-5.2L9.7 3l1.9 2.4c2.4.3 4.4 1.7 5.6 3.7l1.1 2.4-1.7 1.3-2.7-.8-1.6-.2c.9 1.6 2.5 3.1 3.8 4.6l.4 2.6Z",
  b: "M12 1.8a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z M12 5.2c2.6 1.8 4.3 4 4.3 6.2 0 1.8-1 3.1-2.5 3.8L15 19H9l1.2-3.8c-1.5-.7-2.5-2-2.5-3.8 0-2.2 1.7-4.4 4.3-6.2Z",
  r: "M6 3h2.6v2.2h2.1V3h2.6v2.2h2.1V3H18v5l-2 1.6V16l1.5 3h-11L8 16V9.6L6 8Z",
  q: "M12 2a1.6 1.6 0 1 1 0 3.2A1.6 1.6 0 0 1 12 2Z M4.6 5.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z M19.4 5.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z M5.6 9.4l3 4.2 1.4-6.3 2 6.8 2-6.8 1.4 6.3 3-4.2-1.7 9.6H7.3Z",
  k: "M11 1.8h2v2h2v2h-2v1.3c2.6.5 4.6 2.4 4.6 4.7 0 1.4-.6 2.6-1.7 3.5L17 19H7l1.1-3.7c-1.1-.9-1.7-2.1-1.7-3.5 0-2.3 2-4.2 4.6-4.7V5.8H9v-2h2Z",
};

/** A flat chess piece in its colour (white with a soft edge, black outlined). */
export const PieceGlyph = ({
  type,
  color,
  size = 20,
}: {
  type: PieceType;
  color: Color;
  size?: number;
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path
      d={`${SHAPES[type]} ${BASE}`}
      fill={color === "w" ? "#f3ead8" : "#18181a"}
      stroke={color === "w" ? "rgb(0 0 0 / .35)" : "rgb(255 255 255 / .7)"}
      strokeWidth={color === "w" ? 0.6 : 1}
      strokeLinejoin="round"
    />
  </svg>
);

/** A king half white, half black: "either colour". */
export const RandomGlyph = ({ size = 26 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <defs>
      <clipPath id="chess-left-half">
        <rect x="0" y="0" width="12" height="24" />
      </clipPath>
      <clipPath id="chess-right-half">
        <rect x="12" y="0" width="12" height="24" />
      </clipPath>
    </defs>
    <path
      d={`${SHAPES.k} ${BASE}`}
      fill="#f3ead8"
      clipPath="url(#chess-left-half)"
    />
    <path
      d={`${SHAPES.k} ${BASE}`}
      fill="#18181a"
      clipPath="url(#chess-right-half)"
    />
    <path
      d={`${SHAPES.k} ${BASE}`}
      fill="none"
      stroke="rgb(255 255 255 / .7)"
      strokeWidth={0.8}
      strokeLinejoin="round"
    />
  </svg>
);
