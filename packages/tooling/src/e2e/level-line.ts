// packages/tooling/src/e2e/level-line.ts
// Pure: the tap targets an E2E flow needs for one level, from the game's own module. The first
// move is the first listed move that taps can make; the bot's line is testing.bot played from the
// level's seed with playBot's seed rule (the bot's RNG is seedRng(seed ^ 0x5bd1e995)), so the same
// level gives the same line on every machine and in the app. A move's taps are found with the
// board's targetsOfMove and checked through the engine's own intentToMove (a tap in a select
// region first for tap-then-tap games). print-level-line.ts prints the result.
import { starsFor } from '@e07/game-kit/levels/star-rating.ts';
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import type { GameEngine, Outcome } from '@e07/game-kit/contract/game-engine.ts';
import type { LevelEntry } from '@e07/game-kit/contract/levels.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { StarCount } from '@e07/game-kit/levels/star-rating.ts';
import type { BotPolicy } from '@e07/game-kit/testing/play-bot.ts';

type LineEngine<TState, TMove> = Pick<
  GameEngine<TState, TMove, unknown>,
  'create' | 'listMoves' | 'applyMove' | 'outcome' | 'selectRegions' | 'intentToMove'
>;

export type LineGame<TState, TMove> = {
  readonly engine: LineEngine<TState, TMove>;
  /** testing.bot */
  readonly bot: BotPolicy<TState, TMove>;
  /** testing.examples.win: the state action=win-level swaps in. */
  readonly winExample: () => TState;
  /** presentation.board.targetsOfMove; without it no taps can be derived. */
  readonly targetsOfMove?: (state: TState, move: TMove) => readonly BoardTarget[];
};

export type LineStep<TMove> = {
  readonly move: TMove;
  /** The taps in order (select first, then act), or null when taps cannot make this move. */
  readonly taps: readonly BoardTarget[] | null;
};

export type LevelLine<TMove> = {
  readonly first: LineStep<TMove> | null;
  readonly line: readonly LineStep<TMove>[];
  /** How the bot's line ends (won, lost, or still playing at the move cap). */
  readonly outcome: Outcome;
  /** The stars action=win-level earns on this level (the example win, after the flow's one move). */
  readonly winStars: StarCount;
};

/** playBot's rule: the bot's own RNG is seeded from the level's seed. */
const BOT_SEED_MIX = 0x5bd1e995;
/** Moves the level-1 flow makes by taps before action=win-level (what a par rule counts). */
const FLOW_MOVES = 1;

const isSameMove = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The taps that make `move` in `state`, checked through intentToMove; null when none do. */
export function tapsFor<TState, TMove>(
  game: LineGame<TState, TMove>,
  state: TState,
  move: TMove,
): readonly BoardTarget[] | null {
  const targets = game.targetsOfMove?.(state, move) ?? [];
  const isSelect = (target: BoardTarget): boolean =>
    game.engine.selectRegions.includes(target.regionId);
  const selects: readonly (BoardTarget | null)[] = targets.some(isSelect)
    ? targets.filter(isSelect)
    : [null];
  for (const target of targets.filter((candidate) => !isSelect(candidate))) {
    const selected = selects.find((choice) =>
      isSameMove(game.engine.intentToMove(state, { kind: 'tap', target, selected: choice }), move),
    );
    if (selected !== undefined) return selected === null ? [target] : [selected, target];
  }
  return null;
}

function botLine<TState, TMove>(
  game: LineGame<TState, TMove>,
  entry: LevelEntry,
  maxMoves: number,
): { readonly line: LineStep<TMove>[]; readonly outcome: Outcome } {
  let state = game.engine.create(entry.seed, entry.difficulty);
  let rng = seedRng(entry.seed ^ BOT_SEED_MIX);
  const line: LineStep<TMove>[] = [];
  while (line.length < maxMoves) {
    const moves = game.engine.listMoves(state);
    if (game.engine.outcome(state).kind !== 'playing' || moves.length === 0) break;
    const choice = game.bot(state, moves, rng);
    rng = choice.rng;
    line.push({ move: choice.move, taps: tapsFor(game, state, choice.move) });
    state = game.engine.applyMove(state, choice.move).state;
  }
  return { line, outcome: game.engine.outcome(state) };
}

/** The first move a flow can tap, the bot's whole line with its taps, and the win's stars. */
export function levelLine<TState, TMove>(
  game: LineGame<TState, TMove>,
  entry: LevelEntry,
  maxMoves = 1000,
): LevelLine<TMove> {
  const start = game.engine.create(entry.seed, entry.difficulty);
  const first =
    game.engine
      .listMoves(start)
      .map((move) => ({ move, taps: tapsFor(game, start, move) }))
      .find((step) => step.taps !== null) ?? null;
  const win = game.engine.outcome(game.winExample());
  const score = win.kind === 'won' ? win.score : 0;
  const winStars = starsFor(entry.stars, { isWon: win.kind === 'won', moves: FLOW_MOVES, score });
  return { first, ...botLine(game, entry, maxMoves), winStars };
}

const tapText = (taps: readonly BoardTarget[] | null): string =>
  taps === null
    ? 'no taps make this move (a swipe or drag game: write the gesture by hand)'
    : taps
        .map((tap) => `${tap.regionId} col ${String(tap.col)} row ${String(tap.row)}`)
        .join(', then ');

function outcomeText(outcome: Outcome): string {
  if (outcome.kind === 'won') return `won with score ${String(outcome.score)}`;
  return outcome.kind === 'lost' ? `lost (${outcome.reasonKey})` : 'still playing at the move cap';
}

/** The report print-level-line.ts prints (tap targets are the portrait phone layout's regions). */
export function formatLevelLine<TMove>(
  title: string,
  entry: LevelEntry,
  result: LevelLine<TMove>,
): string[] {
  const { first, line, outcome, winStars } = result;
  return [
    `${title} level ${String(entry.level)} (seed ${String(entry.seed)}, difficulty ${String(entry.difficulty)}, stars ${JSON.stringify(entry.stars)})`,
    first === null
      ? 'first move: no listed move can be made by taps'
      : `first move: ${JSON.stringify(first.move)}\n  taps: ${tapText(first.taps)}`,
    `action=win-level earns ${String(winStars)} star(s): assert result.stars-${String(winStars)} and list it in the game's e2e/testids.json`,
    `bot line: ${String(line.length)} moves, ${outcomeText(outcome)}`,
    ...line.map(
      (step, index) =>
        `  ${String(index + 1)}. ${tapText(step.taps)}  ${JSON.stringify(step.move)}`,
    ),
  ];
}
