// Stockfish, in its own Web Worker so the board never waits for it. The
// single-threaded "lite" build runs on any static host (no special headers)
// and is served from /engine/. It speaks UCI: we send text commands and read
// its answer lines.
//
// One search runs at a time. A search that is no longer wanted (undo, a new
// game) is stopped, and its answer comes back marked as stale.

import { HINT_OPTIONS, HINT_SEARCH, goCommand, levelOptions } from "./levels";
import type { Level } from "./levels";

const ENGINE_URL = "/engine/stockfish-19-lite-single.js";

export type SearchResult = {
  /** The move in UCI form (e2e4, e7e8q), or null when there is none. */
  move: string | null;
  /** Thinking time (ms). */
  ms: number;
  /** False when the search was stopped on purpose. */
  wanted: boolean;
};

type Job = {
  commands: string[];
  resolve: (r: SearchResult) => void;
  started: number;
  wanted: boolean;
};

/** The commands sent and the think times, for checking in development. */
export const engineLog = {
  commands: [] as string[],
  searches: [] as Array<{ kind: string; ms: number; move: string | null }>,
};
const record = (cmd: string) => {
  if (process.env.NODE_ENV === "production") return;
  engineLog.commands.push(cmd);
  if (engineLog.commands.length > 400) engineLog.commands.shift();
};

class Engine {
  private worker: Worker | null = null;

  private ready: Promise<boolean> | null = null;

  private queue: Job[] = [];

  private current: Job | null = null;

  /** False once the engine failed to load: the caller falls back. */
  available = true;

  private send(cmd: string) {
    record(cmd);
    this.worker?.postMessage(cmd);
  }

  /** Load the engine (once). Resolves false when it can't run here. */
  start(): Promise<boolean> {
    if (this.ready) return this.ready;
    this.ready = new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        this.available = ok;
        resolve(ok);
      };
      try {
        this.worker = new Worker(ENGINE_URL);
      } catch {
        done(false);
        return;
      }
      const timer = window.setTimeout(() => done(false), 20_000);
      this.worker.onerror = () => {
        window.clearTimeout(timer);
        done(false);
        this.failCurrent();
      };
      this.worker.onmessage = (e: MessageEvent) => {
        const line = String(e.data);
        if (line === "readyok") {
          window.clearTimeout(timer);
          done(true);
          this.pump();
        } else if (line.startsWith("bestmove")) {
          this.finish(line.split(" ")[1] ?? null);
        }
      };
      this.send("uci");
      this.send("setoption name Hash value 16");
      this.send("isready");
    });
    return this.ready;
  }

  private failCurrent() {
    const jobs = [...(this.current ? [this.current] : []), ...this.queue];
    this.current = null;
    this.queue = [];
    jobs.forEach((j) => j.resolve({ move: null, ms: 0, wanted: j.wanted }));
  }

  private finish(raw: string | null) {
    const job = this.current;
    if (!job) return;
    this.current = null;
    const move = raw && raw !== "(none)" ? raw : null;
    job.resolve({
      move,
      ms: performance.now() - job.started,
      wanted: job.wanted,
    });
    this.pump();
  }

  private pump() {
    if (this.current || !this.available || !this.worker) return;
    const job = this.queue.shift();
    if (!job) return;
    if (!job.wanted) {
      job.resolve({ move: null, ms: 0, wanted: false });
      this.pump();
      return;
    }
    this.current = job;
    job.started = performance.now();
    job.commands.forEach((c) => this.send(c));
  }

  private search(commands: string[]): Promise<SearchResult> {
    return new Promise((resolve) => {
      this.queue.push({ commands, resolve, started: 0, wanted: true });
      void this.start().then((ok) => {
        if (ok) this.pump();
        else this.failCurrent();
      });
    });
  }

  /** The computer's move at a level. */
  think(fen: string, level: Level, maxMs: number): Promise<SearchResult> {
    const movetime = Math.min(level.movetime, maxMs);
    return this.search([
      ...levelOptions(level),
      `position fen ${fen}`,
      goCommand(movetime, level.depth),
    ]);
  }

  /** The best move at full strength, for a hint. */
  hint(fen: string): Promise<SearchResult> {
    return this.search([
      ...HINT_OPTIONS,
      `position fen ${fen}`,
      goCommand(HINT_SEARCH.movetime, HINT_SEARCH.depth),
    ]);
  }

  /** Drop every search in flight or waiting (their answers come back stale). */
  cancelAll() {
    this.queue = this.queue.map((j) => ({ ...j, wanted: false }));
    if (this.current) {
      this.current.wanted = false;
      this.send("stop");
    }
  }

  newGame() {
    this.cancelAll();
    if (this.worker && this.available) this.send("ucinewgame");
  }
}

export const engine = new Engine();
