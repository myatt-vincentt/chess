// The controls, on Night glass, kept clear of the middle of the board.
//
//   start      a small sheet: your colour (white, black or either), the
//              computer's level (rating chips), the clock, Play
//   playing    top: the two players (rating, taken pieces, clocks; the
//              computer's dot pulses while it thinks) and the last moves;
//              bottom: undo, hint, new game, clock, sound
//   promotion  four pieces to choose from (a tap elsewhere keeps the queen)
//   game over  a small card with the result and New game
//
// Each panel tells the board how much room it takes, so the board always
// fits between them.
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Html } from "@react-three/drei";

import { formatClock } from "./clock.sim";
import {
  canUndo,
  choosePromotion,
  engineColor,
  game,
  newGame,
  requestHint,
  setClockPreset,
  startGame,
  toggleSound,
  undo,
  updateSettings,
  useClockTick,
  useGame,
} from "./game";
import type { ColorChoice } from "./game";
import { reserved } from "./fit";
import {
  ClockIcon,
  HintIcon,
  NewIcon,
  PieceGlyph,
  RandomGlyph,
  SoundIcon,
  UndoIcon,
} from "./icons";
import { CLOCKS, LEVELS } from "./levels";
import { ARLES } from "./look";
import { capturedOf } from "./roster";
import type { Color } from "./roster";
import { clearDrag } from "./drag";

const CYPRESS = "#232528";

const CSS = `
.ch-root { position: absolute; inset: 0; pointer-events: none; color: #fff;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.ch-glass { background: rgb(35 37 40 / .64);
  backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border: 1px solid rgb(235 246 253 / .18);
  box-shadow: inset 0 1px 1px rgb(255 255 255 / .22), 0 8px 24px rgb(0 0 0 / .22); }
.ch-strong { background: rgb(35 37 40 / .82); }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .ch-glass { background: rgb(35 37 40 / .84); } }
.ch-scrim-top { position: absolute; left: 0; right: 0; top: 0; height: 150px;
  background: linear-gradient(rgb(35 37 40 / .5), rgb(35 37 40 / 0)); }
.ch-scrim-bottom { position: absolute; left: 0; right: 0; bottom: 0; height: 200px;
  background: linear-gradient(rgb(35 37 40 / 0), rgb(35 37 40 / .55)); }
.ch-btn { pointer-events: auto; border: 0; padding: 0; margin: 0; color: inherit; font: inherit;
  display: grid; place-items: center; cursor: pointer; outline: none; touch-action: manipulation;
  transition: transform 160ms ease-out, background-color 160ms ease-out,
    box-shadow 160ms ease-out, opacity 160ms ease-out; }
.ch-btn:active { transform: scale(0.96); }
.ch-btn:focus-visible { box-shadow: 0 0 0 2px ${ARLES}; }
.ch-btn:disabled { opacity: .38; cursor: default; }
.ch-btn:disabled:active { transform: none; }
.ch-round { width: 44px; height: 44px; border-radius: 50%; flex: none; }
.ch-round.on { background: ${ARLES}; color: ${CYPRESS}; }
.ch-top { position: absolute; top: calc(env(safe-area-inset-top) + 12px); left: 72px; right: 16px;
  display: flex; justify-content: flex-end; align-items: flex-start; gap: 8px; }
.ch-players { border-radius: 18px; padding: 8px 12px; display: grid; gap: 4px; min-width: 0; }
.ch-player { display: grid; grid-template-columns: 10px auto 1fr auto; align-items: center;
  gap: 8px; height: 24px; font-size: 14px; }
.ch-dot { width: 10px; height: 10px; border-radius: 50%; box-sizing: border-box; }
.ch-dot.w { background: #f3ead8; }
.ch-dot.b { background: #18181a; border: 1.5px solid rgb(255 255 255 / .75); }
.ch-dot.thinking { animation: ch-think 900ms ease-out infinite alternate; }
@keyframes ch-think { from { box-shadow: 0 0 0 0 rgb(244 217 104 / .0); }
  to { box-shadow: 0 0 0 4px rgb(244 217 104 / .55), 0 0 12px rgb(244 217 104 / .8); } }
.ch-name { font-weight: 600; white-space: nowrap; }
.ch-name small { font-weight: 500; opacity: .75; margin-left: 4px; }
.ch-taken { display: flex; align-items: center; min-width: 0; overflow: hidden; }
.ch-taken svg { flex: none; margin-right: -5px; }
.ch-taken .adv { font-size: 12px; opacity: .8; margin-left: 9px; }
.ch-time { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 14px;
  padding: 1px 7px; border-radius: 8px; background: rgb(255 255 255 / .08); }
.ch-time.run { background: ${ARLES}; color: ${CYPRESS}; }
.ch-time.low.run { background: #ff6a5c; color: #fff; }
.ch-moves { border-radius: 18px; padding: 8px 12px; font-size: 13px; line-height: 20px;
  font-variant-numeric: tabular-nums; display: grid; grid-template-columns: auto auto auto;
  column-gap: 8px; min-width: 112px; }
.ch-moves .n { opacity: .55; }
.ch-moves .last { color: ${ARLES}; font-weight: 600; }
.ch-bottom { position: absolute; left: 50%; transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom) + 24px); width: min(calc(100% - 32px), 420px);
  display: flex; flex-direction: column; align-items: center; gap: 10px; }
.ch-band { display: flex; gap: 6px; padding: 5px; border-radius: 999px; }
.ch-band .ch-round { background: transparent; }
.ch-band .ch-round.busy { animation: ch-busy 900ms ease-out infinite alternate; }
@keyframes ch-busy { from { background: rgb(244 217 104 / .1); } to { background: rgb(244 217 104 / .45); } }
.ch-pop { display: flex; gap: 6px; padding: 5px; border-radius: 999px; }
.ch-chip { pointer-events: auto; height: 40px; padding: 0 14px; border-radius: 999px; font-size: 14px;
  font-weight: 600; background: rgb(255 255 255 / .06); white-space: nowrap; }
.ch-chip.on { background: ${ARLES}; color: ${CYPRESS}; }
.ch-sheet { pointer-events: auto; border-radius: 28px; padding: 16px; width: 100%; box-sizing: border-box;
  display: grid; gap: 12px; }
.ch-label { font-size: 13px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase;
  color: rgb(235 246 253 / .8); margin-bottom: 6px; }
.ch-colors { display: flex; gap: 10px; }
.ch-colors .ch-btn { width: 52px; height: 52px; border-radius: 50%; background: rgb(255 255 255 / .07); }
.ch-colors .ch-btn.on { box-shadow: 0 0 0 2px ${ARLES}; background: rgb(244 217 104 / .16); }
.ch-levels { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.ch-level { pointer-events: auto; height: 48px; border-radius: 14px; background: rgb(255 255 255 / .06);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; }
.ch-level span { font-size: 12px; font-weight: 500; color: rgb(235 246 253 / .85); }
.ch-level b { font-size: 17px; font-weight: 700; color: ${ARLES}; font-variant-numeric: tabular-nums; }
.ch-level.on { background: ${ARLES}; }
.ch-level.on span, .ch-level.on b { color: ${CYPRESS}; }
.ch-clocks { display: flex; gap: 6px; flex-wrap: wrap; }
.ch-primary { pointer-events: auto; height: 52px; border-radius: 999px; background: ${ARLES}; color: ${CYPRESS};
  font-size: 16px; font-weight: 700; width: 100%; }
.ch-note { font-size: 11px; line-height: 15px; color: rgb(235 246 253 / .6); text-align: center; }
.ch-card { pointer-events: auto; border-radius: 24px; padding: 14px 16px; display: flex; align-items: center;
  gap: 14px; width: 100%; box-sizing: border-box; }
.ch-card .what { flex: 1; min-width: 0; }
.ch-card .title { font-size: 26px; font-weight: 800; color: ${ARLES}; line-height: 1.1; }
.ch-card .why { font-size: 14px; color: rgb(235 246 253 / .85); margin-top: 2px; }
.ch-card .ch-primary { width: auto; padding: 0 20px; height: 48px; }
.ch-catch { position: absolute; inset: 0; pointer-events: auto; }
.ch-enter { animation: ch-enter 240ms ease-out both; }
@keyframes ch-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .ch-btn:active { transform: none; } .ch-enter { animation: none; }
  .ch-dot.thinking, .ch-band .ch-round.busy { animation: none; } }
`;

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const Taken = ({ color }: { color: Color }) => {
  // The pieces `color` has taken (of the other colour), and the lead in points.
  const other: Color = color === "w" ? "b" : "w";
  const taken = capturedOf(game.roster, other);
  const lost = capturedOf(game.roster, color);
  const lead =
    taken.reduce((s, p) => s + VALUE[p.type], 0) -
    lost.reduce((s, p) => s + VALUE[p.type], 0);
  const order = "qrbnp";
  const sorted = [...taken].sort(
    (a, b) => order.indexOf(a.type) - order.indexOf(b.type),
  );
  return (
    <span className="ch-taken">
      {sorted.map((p) => (
        <PieceGlyph key={p.id} type={p.type} color={p.color} size={16} />
      ))}
      {lead > 0 ? <span className="adv">+{lead}</span> : null}
    </span>
  );
};

const ClockFace = ({ color }: { color: Color }) => {
  useClockTick();
  const c = game.clock;
  if (!c) return null;
  const ms = c.left[color];
  const run = c.running === color;
  return (
    <span className={`ch-time${run ? " run" : ""}${ms < 20_000 ? " low" : ""}`}>
      {formatClock(ms)}
    </span>
  );
};

const Players = () => {
  const computer = engineColor();
  const level = LEVELS[game.settings.level];
  const row = (color: Color, name: ReactNode, thinking: boolean) => (
    <div className="ch-player">
      <span className={`ch-dot ${color}${thinking ? " thinking" : ""}`} />
      <span className="ch-name">{name}</span>
      <Taken color={color} />
      <ClockFace color={color} />
    </div>
  );
  return (
    <div className="ch-players ch-glass">
      {row(
        computer,
        <>
          {level.elo}
          <small>{level.label}</small>
        </>,
        game.thinking,
      )}
      {row(game.userColor, "You", false)}
    </div>
  );
};

const Moves = () => {
  const { sans } = game;
  if (sans.length === 0) return null;
  // The last three moves, numbered as in a score sheet.
  const firstPly = Math.max(0, sans.length - 6);
  const startPly = firstPly - (firstPly % 2);
  const rows: Array<{
    n: number;
    w?: string;
    b?: string;
    wi: number;
    bi: number;
  }> = [];
  for (let i = startPly; i < sans.length; i += 2) {
    rows.push({ n: i / 2 + 1, w: sans[i], b: sans[i + 1], wi: i, bi: i + 1 });
  }
  const lastIdx = sans.length - 1;
  return (
    <div className="ch-moves ch-glass" aria-label="Moves">
      {rows.map((r) => [
        <span key={`n${r.n}`} className="n">
          {r.n}.
        </span>,
        <span key={`w${r.n}`} className={r.wi === lastIdx ? "last" : ""}>
          {r.w}
        </span>,
        <span key={`b${r.n}`} className={r.bi === lastIdx ? "last" : ""}>
          {r.b ?? ""}
        </span>,
      ])}
    </div>
  );
};

const Setup = () => {
  const { settings } = game;
  const colours: Array<{ id: ColorChoice; label: string; glyph: ReactNode }> = [
    {
      id: "w",
      label: "Play white",
      glyph: <PieceGlyph type="k" color="w" size={30} />,
    },
    {
      id: "b",
      label: "Play black",
      glyph: <PieceGlyph type="k" color="b" size={30} />,
    },
    { id: "random", label: "Either colour", glyph: <RandomGlyph size={30} /> },
  ];
  return (
    <div className="ch-sheet ch-glass ch-strong ch-enter">
      <div>
        <div className="ch-label">Play as</div>
        <div className="ch-colors">
          {colours.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`ch-btn${settings.color === c.id ? " on" : ""}`}
              aria-label={c.label}
              aria-pressed={settings.color === c.id}
              onClick={() => updateSettings({ color: c.id })}
            >
              {c.glyph}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="ch-label">Computer</div>
        <div className="ch-levels">
          {LEVELS.map((l, i) => (
            <button
              key={l.id}
              type="button"
              className={`ch-btn ch-level${settings.level === i ? " on" : ""}`}
              aria-pressed={settings.level === i}
              onClick={() => updateSettings({ level: i })}
            >
              <span>{l.label}</span>
              <b>{l.elo}</b>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="ch-label">Clock</div>
        <div className="ch-clocks">
          {CLOCKS.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className={`ch-btn ch-chip${settings.clock === i ? " on" : ""}`}
              aria-pressed={settings.clock === i}
              onClick={() => updateSettings({ clock: i })}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="ch-btn ch-primary" onClick={startGame}>
        Play
      </button>
      <div className="ch-note">
        Engine: Stockfish, GPL-3.0 · Hand model: scribbletoad, CC BY 4.0
      </div>
    </div>
  );
};

const RESULT_TITLE = { win: "You win", loss: "You lose", draw: "Draw" };

const Band = ({
  clockOpen,
  setClockOpen,
}: {
  clockOpen: boolean;
  setClockOpen: (open: boolean) => void;
}) => {
  const yourTurn = game.phase === "play" && !game.thinking;
  return (
    <>
      {clockOpen ? (
        <div className="ch-pop ch-glass ch-enter">
          {CLOCKS.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className={`ch-btn ch-chip${game.settings.clock === i ? " on" : ""}`}
              onClick={() => {
                setClockPreset(i);
                setClockOpen(false);
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="ch-band ch-glass">
        <button
          type="button"
          className="ch-btn ch-round"
          aria-label="Undo"
          disabled={!canUndo()}
          onClick={() => {
            clearDrag();
            undo();
          }}
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          className={`ch-btn ch-round${game.hinting ? " busy" : ""}`}
          aria-label="Hint"
          disabled={!yourTurn || !!game.promotion}
          onClick={() => void requestHint()}
        >
          <HintIcon />
        </button>
        <button
          type="button"
          className="ch-btn ch-round"
          aria-label="New game"
          onClick={() => {
            clearDrag();
            newGame();
          }}
        >
          <NewIcon />
        </button>
        <button
          type="button"
          className={`ch-btn ch-round${clockOpen ? " on" : ""}`}
          aria-label="Clock"
          onClick={() => setClockOpen(!clockOpen)}
        >
          <ClockIcon />
        </button>
        <button
          type="button"
          className="ch-btn ch-round"
          aria-label={game.soundOn ? "Sound off" : "Sound on"}
          onClick={toggleSound}
        >
          <SoundIcon on={game.soundOn} />
        </button>
      </div>
    </>
  );
};

const Promotion = () => {
  const color = game.userColor;
  return (
    <div className="ch-pop ch-glass ch-enter">
      {(["q", "r", "b", "n"] as const).map((t) => (
        <button
          key={t}
          type="button"
          className="ch-btn ch-round"
          aria-label={{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[t]}
          style={{ background: "rgb(255 255 255 / .08)" }}
          onClick={() => choosePromotion(t)}
        >
          <PieceGlyph type={t} color={color} size={28} />
        </button>
      ))}
    </div>
  );
};

const ResultCard = () => {
  const r = game.result;
  if (!r) return null;
  return (
    <div className="ch-card ch-glass ch-strong ch-enter" role="status">
      <div className="what">
        <div className="title">{RESULT_TITLE[r.outcome]}</div>
        <div className="why">{r.reason}</div>
      </div>
      <button
        type="button"
        className="ch-btn ch-primary"
        onClick={() => {
          clearDrag();
          newGame();
        }}
      >
        New game
      </button>
    </div>
  );
};

export const Hud = () => {
  useGame();
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Tell the board how much room the panels take.
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      const h = window.innerHeight;
      const t = top.current?.getBoundingClientRect();
      const b = bottom.current?.getBoundingClientRect();
      reserved.top = t && t.height > 0 ? t.bottom + 12 : 64;
      reserved.bottom = b && b.height > 0 ? h - b.top + 12 : 96;
      raf = window.setTimeout(measure, 200);
    };
    measure();
    return () => window.clearTimeout(raf);
  }, []);

  const [clockOpen, setClockOpen] = useState(false);
  const setup = game.phase === "setup";
  const catcher = !setup && (clockOpen || !!game.promotion);
  return (
    <Html fullscreen zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
      <style>{CSS}</style>
      <div className="ch-root">
        <div className="ch-scrim-top" />
        <div className="ch-scrim-bottom" />
        {catcher ? (
          // A tap anywhere else closes the clock choice, or keeps the queen.
          <div
            className="ch-catch"
            role="presentation"
            onPointerDown={() => {
              if (game.promotion) choosePromotion("q");
              setClockOpen(false);
            }}
          />
        ) : null}
        <div className="ch-top" ref={top}>
          {setup ? null : (
            <>
              <Players />
              <Moves />
            </>
          )}
        </div>
        <div className="ch-bottom" ref={bottom}>
          {setup ? <Setup /> : null}
          {!setup && game.promotion ? <Promotion /> : null}
          {!setup ? <ResultCard /> : null}
          {!setup ? (
            <Band clockOpen={clockOpen} setClockOpen={setClockOpen} />
          ) : null}
        </div>
      </div>
    </Html>
  );
};
