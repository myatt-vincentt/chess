// The computer's strength presets and the clock presets.
//
// Stockfish limits its own strength in two ways. From 1320 up it plays to an
// Elo rating (UCI_LimitStrength + UCI_Elo). Below that, the beginner levels
// use its Skill Level (0–20) with a very shallow search, plus an occasional
// loose move, so a new player gets real chances. The numbers on the chips are
// approximate ratings.

export type Level = {
  id: string;
  label: string;
  /** The rating shown on the chip. */
  elo: number;
  /** Stockfish Skill Level (0–20); used when `uciElo` is null. */
  skill: number;
  /** Plays to this Elo (Stockfish allows 1320–3190), or null for `skill`. */
  uciElo: number | null;
  /** Thinking time per move (ms). */
  movetime: number;
  /** Search depth cap, or null for none. */
  depth: number | null;
  /** Chance of playing a random legal move instead of the engine's. */
  looseMove: number;
};

export const LEVELS: readonly Level[] = [
  {
    id: "beginner",
    label: "Beginner",
    elo: 800,
    skill: 0,
    uciElo: null,
    movetime: 150,
    depth: 1,
    looseMove: 0.3,
  },
  {
    id: "casual",
    label: "Casual",
    elo: 1100,
    skill: 3,
    uciElo: null,
    movetime: 250,
    depth: 4,
    looseMove: 0.08,
  },
  {
    id: "club",
    label: "Club",
    elo: 1400,
    skill: 20,
    uciElo: 1400,
    movetime: 400,
    depth: null,
    looseMove: 0,
  },
  {
    id: "strong",
    label: "Strong",
    elo: 1800,
    skill: 20,
    uciElo: 1800,
    movetime: 600,
    depth: null,
    looseMove: 0,
  },
  {
    id: "expert",
    label: "Expert",
    elo: 2200,
    skill: 20,
    uciElo: 2200,
    movetime: 900,
    depth: null,
    looseMove: 0,
  },
  {
    id: "master",
    label: "Master",
    elo: 2600,
    skill: 20,
    uciElo: 2600,
    movetime: 1200,
    depth: null,
    looseMove: 0,
  },
];

export const DEFAULT_LEVEL = 2;

/** The UCI options that set a level, sent before each search. */
export const levelOptions = (level: Level): string[] =>
  level.uciElo === null
    ? [
        "setoption name UCI_LimitStrength value false",
        `setoption name Skill Level value ${level.skill}`,
      ]
    : [
        "setoption name Skill Level value 20",
        "setoption name UCI_LimitStrength value true",
        `setoption name UCI_Elo value ${level.uciElo}`,
      ];

/** Full strength, for the hint. */
export const HINT_OPTIONS = [
  "setoption name UCI_LimitStrength value false",
  "setoption name Skill Level value 20",
];
export const HINT_SEARCH = { movetime: 1200, depth: 18 };

/** The `go` command for a level, with the time capped by the clock. */
export const goCommand = (movetime: number, depth: number | null): string =>
  depth === null
    ? `go movetime ${Math.max(50, Math.round(movetime))}`
    : `go depth ${depth} movetime ${Math.max(50, Math.round(movetime))}`;

export type ClockPreset = {
  id: string;
  label: string;
  /** Starting time per side (ms), or 0 for no clock. */
  baseMs: number;
  /** Added after each move (ms). */
  incrementMs: number;
};

export const CLOCKS: readonly ClockPreset[] = [
  { id: "off", label: "Off", baseMs: 0, incrementMs: 0 },
  { id: "5", label: "5 min", baseMs: 5 * 60_000, incrementMs: 0 },
  { id: "10", label: "10 min", baseMs: 10 * 60_000, incrementMs: 0 },
  { id: "3+2", label: "3+2", baseMs: 3 * 60_000, incrementMs: 2_000 },
];
