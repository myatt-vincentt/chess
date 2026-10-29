// The game: the position (chess.js), the pieces (roster.ts), whose turn it is,
// the computer's replies (engine.ts), the clock, undo, hint and the result.
// Components read it with `useGame()` and re-render only on a game event; the
// clock has its own, more frequent, channel (`useClockTick()`).
import { useSyncExternalStore } from "react";
import { Chess } from "chess.js";
import type { Move } from "chess.js";

import { playSfx, setSoundEnabled, unlockAudio } from "./audio";
import { createClock, pressClock, stopClock, tickClock } from "./clock.sim";
import type { Clock } from "./clock.sim";
import { engine, engineLog } from "./engine";
import { CLOCKS, DEFAULT_LEVEL, LEVELS } from "./levels";
import { applyMove, initialRoster } from "./roster";
import type { Color, PieceType, Roster, Square } from "./roster";
import { setPlayerSide } from "./view";

export type Phase = "setup" | "play" | "over";
export type Outcome = "win" | "loss" | "draw";
export type Result = { outcome: Outcome; reason: string };
export type ColorChoice = Color | "random";
export type Settings = { color: ColorChoice; level: number; clock: number };
export type MoveSource = "pointer" | "hand";

/** A reply never lands sooner than this after the player's move (ms). */
const MIN_REPLY_MS = 550;
/** Before the computer's first move as white (ms): the board turns first. */
const OPENING_PAUSE_MS = 900;
/** How long a hint stays lit (ms). */
const HINT_MS = 3200;

const chess = new Chess();

export const game = {
  phase: "setup" as Phase,
  settings: { color: "w", level: DEFAULT_LEVEL, clock: 0 } as Settings,
  userColor: "w" as Color,
  roster: initialRoster(),
  /** The roster after each ply (index 0 = the start). */
  rosters: [initialRoster()] as Roster[],
  sans: [] as string[],
  lastMove: null as { from: Square; to: Square } | null,
  checkSquare: null as Square | null,
  thinking: false,
  hinting: false,
  hint: null as { from: Square; to: Square; at: number } | null,
  result: null as Result | null,
  clock: null as Clock | null,
  soundOn: false,
  /** A pawn waiting for the player to pick what it becomes. */
  promotion: null as { from: Square; to: Square } | null,
  /** Moves made by hand so far (the hand hint goes after the first). */
  handMoves: 0,
  version: 0,
};

const listeners = new Set<() => void>();
const clockListeners = new Set<() => void>();
const notify = () => {
  game.version += 1;
  listeners.forEach((l) => l());
};
let clockVersion = 0;
const notifyClock = () => {
  clockVersion += 1;
  clockListeners.forEach((l) => l());
};

export const useGame = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => game.version,
  );

export const useClockTick = () =>
  useSyncExternalStore(
    (l) => {
      clockListeners.add(l);
      return () => clockListeners.delete(l);
    },
    () => clockVersion,
  );

export const engineColor = (): Color => (game.userColor === "w" ? "b" : "w");
export const turn = (): Color => chess.turn();
export const fen = () => chess.fen();

/** Legal destinations of the piece on `from` (for highlights). */
export const legalTargets = (from: Square): Square[] =>
  chess.moves({ square: from, verbose: true }).map((m) => m.to as Square);

export const pieceAt = (sq: Square) => chess.get(sq);

/** Can the player pick up the piece on `sq` right now? */
export const canPick = (sq: Square) => {
  if (game.phase !== "play" || game.thinking || game.promotion) return false;
  if (chess.turn() !== game.userColor) return false;
  const p = chess.get(sq);
  return !!p && p.color === game.userColor;
};

const kingSquare = (color: Color): Square | null => {
  const rows = chess.board();
  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      const p = rows[r][f];
      if (p && p.type === "k" && p.color === color) return p.square as Square;
    }
  }
  return null;
};

/** Only a king, or a king and one knight or bishop: no way to mate. */
const cannotMate = (color: Color) => {
  const own = chess
    .board()
    .flat()
    .filter((p) => p && p.color === color && p.type !== "k");
  return own.length === 0 || (own.length === 1 && "nb".includes(own[0]!.type));
};

let token = 0;
let hintTimer = 0;

const endGame = (result: Result) => {
  game.result = result;
  game.phase = "over";
  game.thinking = false;
  if (game.clock) stopClock(game.clock);
  engine.cancelAll();
  token += 1;
};

const checkEnd = (mover: Color): boolean => {
  const userMoved = mover === game.userColor;
  if (chess.isCheckmate()) {
    endGame({ outcome: userMoved ? "win" : "loss", reason: "Checkmate" });
    return true;
  }
  let reason: string | null = null;
  if (chess.isStalemate()) reason = "Stalemate";
  else if (chess.isInsufficientMaterial()) reason = "Insufficient material";
  else if (chess.isThreefoldRepetition()) reason = "Repetition";
  else if (chess.isDrawByFiftyMoves()) reason = "50-move rule";
  if (reason) {
    endGame({ outcome: "draw", reason });
    return true;
  }
  return false;
};

const afterPosition = () => {
  const history = chess.history({ verbose: true });
  const last = history[history.length - 1];
  game.lastMove = last
    ? { from: last.from as Square, to: last.to as Square }
    : null;
  game.checkSquare = chess.inCheck() ? kingSquare(chess.turn()) : null;
};

/** The computer's turn, set below (it needs `play`). */
let engineTurn: () => Promise<void> = async () => {};
const scheduleEngine = (delay = 0) =>
  window.setTimeout(() => void engineTurn(), delay);

/** Play a legal move on the board. False when it is not legal. */
const play = (from: string, to: string, promotion?: string): boolean => {
  let m: Move;
  try {
    m = chess.move({ from, to, promotion });
  } catch {
    return false;
  }
  game.roster = applyMove(game.roster, m);
  game.rosters.push(game.roster);
  game.sans.push(m.san);
  game.hint = null;
  game.promotion = null;
  afterPosition();
  if (game.clock) pressClock(game.clock, m.color);
  const over = checkEnd(m.color);
  playSfx(m.captured ? "capture" : "move");
  if (over && game.result?.reason === "Checkmate") playSfx("mate");
  else if (chess.inCheck()) playSfx("check");
  notify();
  notifyClock();
  if (!over && chess.turn() !== game.userColor) scheduleEngine();
  return true;
};

/** A random legal move, captures first: the beginner's loose move. */
const looseMove = (): string | null => {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  const captures = moves.filter((m) => m.captured);
  const pool = captures.length && Math.random() < 0.5 ? captures : moves;
  const m = pool[Math.floor(Math.random() * pool.length)];
  return `${m.from}${m.to}${m.promotion ?? ""}`;
};

engineTurn = async () => {
  if (game.phase !== "play" || chess.turn() === game.userColor) return;
  if (game.thinking) return;
  token += 1;
  const mine = token;
  game.thinking = true;
  notify();
  const level = LEVELS[game.settings.level];
  const left = game.clock?.left[engineColor()];
  const maxMs = left ? Math.max(80, left / 30) : Infinity;
  const started = performance.now();
  const result = await engine.think(chess.fen(), level, maxMs);
  if (mine !== token || !result.wanted) return;
  if (process.env.NODE_ENV !== "production") {
    engineLog.searches.push({
      kind: level.id,
      ms: result.ms,
      move: result.move,
    });
  }
  const wait = MIN_REPLY_MS - (performance.now() - started);
  if (wait > 0) {
    await new Promise<void>((r) => {
      window.setTimeout(r, wait);
    });
  }
  if (mine !== token || game.phase !== "play") return;
  game.thinking = false;
  const loose =
    !engine.available || !result.move || Math.random() < level.looseMove;
  const uci = loose ? looseMove() : result.move;
  if (!uci || !play(uci.slice(0, 2), uci.slice(2, 4), uci[4])) {
    notify();
  }
};

/**
 * The player moves a piece. A pawn reaching the last row becomes a queen by
 * hand; with the mouse or a finger a small chooser opens first. Returns false
 * for an illegal move (the piece goes back).
 */
export const userMove = (
  from: Square,
  to: Square,
  source: MoveSource,
): boolean => {
  if (!canPick(from)) return false;
  const move = chess
    .moves({ square: from, verbose: true })
    .find((m) => m.to === to);
  if (!move) return false;
  if (move.promotion && source === "pointer") {
    game.promotion = { from, to };
    notify();
    return true;
  }
  if (source === "hand") game.handMoves += 1;
  return play(from, to, move.promotion ? "q" : undefined);
};

export const choosePromotion = (type: Exclude<PieceType, "p" | "k">) => {
  const p = game.promotion;
  if (!p) return;
  play(p.from, p.to, type);
};

export const canUndo = () =>
  game.phase !== "setup" &&
  game.result?.reason !== "Time" &&
  !game.promotion &&
  chess.history({ verbose: true }).some((m) => m.color === game.userColor);

/** Take back the player's last move (and the computer's reply to it). */
export const undo = () => {
  if (!canUndo()) return;
  engine.cancelAll();
  token += 1;
  game.thinking = false;
  game.hinting = false;
  let removedOwn = false;
  while (chess.history().length > 0) {
    const m = chess.undo();
    game.rosters.pop();
    game.sans.pop();
    if (m?.color === game.userColor) removedOwn = true;
    if (removedOwn && chess.turn() === game.userColor) break;
  }
  game.roster = game.rosters[game.rosters.length - 1];
  game.result = null;
  game.phase = "play";
  game.hint = null;
  afterPosition();
  if (game.clock) {
    game.clock.flagged = null;
    game.clock.running = chess.history().length > 0 ? chess.turn() : null;
  }
  notify();
  notifyClock();
};

/** Ask the engine for the best move at full strength and light it up. */
export const requestHint = async () => {
  if (game.phase !== "play" || game.thinking || game.hinting) return;
  if (chess.turn() !== game.userColor || game.promotion) return;
  game.hinting = true;
  notify();
  const position = chess.fen();
  const mine = token;
  const result = await engine.hint(position);
  game.hinting = false;
  if (process.env.NODE_ENV !== "production") {
    engineLog.searches.push({ kind: "hint", ms: result.ms, move: result.move });
  }
  if (
    mine === token &&
    result.wanted &&
    result.move &&
    chess.fen() === position
  ) {
    game.hint = {
      from: result.move.slice(0, 2) as Square,
      to: result.move.slice(2, 4) as Square,
      at: performance.now(),
    };
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => {
      game.hint = null;
      notify();
    }, HINT_MS);
  }
  notify();
};

/** Back to the setup sheet; the pieces go home. */
export const newGame = () => {
  engine.cancelAll();
  token += 1;
  chess.reset();
  game.phase = "setup";
  game.roster = initialRoster();
  game.rosters = [game.roster];
  game.sans = [];
  game.thinking = false;
  game.hinting = false;
  game.hint = null;
  game.result = null;
  game.promotion = null;
  game.clock = null;
  afterPosition();
  notify();
  notifyClock();
};

export const updateSettings = (next: Partial<Settings>) => {
  game.settings = { ...game.settings, ...next };
  if (next.color && next.color !== "random") setPlayerSide(next.color);
  notify();
};

/** Start a game with the chosen settings (from the Play tap). */
export const startGame = () => {
  unlockAudio();
  if (!game.soundOn) {
    game.soundOn = true;
    setSoundEnabled(true);
  }
  void engine.start();
  if (chess.history().length > 0) newGame();
  const { color, clock } = game.settings;
  const coin: Color = Math.random() < 0.5 ? "w" : "b";
  game.userColor = color === "random" ? coin : color;
  setPlayerSide(game.userColor);
  engine.newGame();
  const preset = CLOCKS[clock];
  game.clock = preset.baseMs
    ? createClock(preset.baseMs, preset.incrementMs)
    : null;
  game.phase = "play";
  notify();
  notifyClock();
  if (game.userColor === "b") scheduleEngine(OPENING_PAUSE_MS);
};

/** Change the clock mid-game: both sides start the new time afresh. */
export const setClockPreset = (index: number) => {
  game.settings = { ...game.settings, clock: index };
  const preset = CLOCKS[index];
  if (game.phase === "play") {
    game.clock = preset.baseMs
      ? createClock(preset.baseMs, preset.incrementMs)
      : null;
    if (game.clock && chess.history().length > 0)
      game.clock.running = chess.turn();
  }
  notify();
  notifyClock();
};

export const toggleSound = () => {
  game.soundOn = !game.soundOn;
  setSoundEnabled(game.soundOn);
  notify();
};

// The clock runs on its own timer so it keeps time while the tab is busy.
let lastTick = 0;
window.setInterval(() => {
  const now = performance.now();
  const dt = lastTick ? now - lastTick : 0;
  lastTick = now;
  const c = game.clock;
  if (!c || game.phase !== "play" || !c.running) return;
  const flagged = tickClock(c, dt);
  if (flagged) {
    const other: Color = flagged === "w" ? "b" : "w";
    const lost: Outcome = flagged === game.userColor ? "loss" : "win";
    endGame({
      outcome: cannotMate(other) ? "draw" : lost,
      reason: "Time",
    });
    notify();
  }
  notifyClock();
}, 100);

/** For development checks: play a move for either side, stopping the engine. */
export const devPlay = (from: string, to: string, promotion?: string) => {
  engine.cancelAll();
  token += 1;
  game.thinking = false;
  return play(from, to, promotion);
};

/** For development checks: the live chess.js game. */
export const devChess = () => chess;
