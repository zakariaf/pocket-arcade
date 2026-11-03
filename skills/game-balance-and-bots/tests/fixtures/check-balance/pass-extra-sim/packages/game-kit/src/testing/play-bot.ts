// packages/game-kit/src/testing/play-bot.ts
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import type { GameEngine, Outcome } from '@e07/game-kit/contract/game-engine.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** A bot picks one of the legal moves. It gets its own seeded RNG, never Math.random. */
export type BotPolicy<TState, TMove> = (
  state: TState,
  moves: readonly TMove[],
  rng: RngState,
) => { readonly move: TMove; readonly rng: RngState };

/** The engine subset a bot needs; any GameModule satisfies it. */
export type BotGame<TState, TMove, TEvent> = Pick<
  GameEngine<TState, TMove, TEvent>,
  'create' | 'listMoves' | 'applyMove' | 'outcome'
>;

/** How one bot game ended and after how many moves. */
export type BotRun = { readonly outcome: Outcome; readonly moves: number };

/** Seed, difficulty, policy and a hard move cap (a stuck bot must end, not hang). */
export type BotOptions<TState, TMove> = {
  readonly seed: number;
  readonly difficulty: number;
  readonly policy: BotPolicy<TState, TMove>;
  readonly maxMoves: number;
};

/** Uniformly random legal move; the baseline for winnability and difficulty curves. */
export function randomPolicy<TState, TMove>(): BotPolicy<TState, TMove> {
  return (_state, moves, rng) => {
    const draw = nextInt(rng, moves.length);
    const move = moves[draw.value];
    if (move === undefined) throw new Error('randomPolicy called without legal moves');
    return { move, rng: draw.state };
  };
}

/** One move of a bot game and the state it was made from. */
export type BotStep<TState, TMove> = { readonly state: TState; readonly move: TMove };

/**
 * The one bot loop: the bot's own RNG seeded from the game's seed (seedRng(seed ^ 0x5bd1e995)),
 * a move per turn until the game ends, no move is legal or the cap is reached. `onStep` sees each
 * state with the move made from it (playBotLine); it never changes the game.
 */
function runBot<TState, TMove, TEvent>(
  game: BotGame<TState, TMove, TEvent>,
  options: BotOptions<TState, TMove>,
  onStep: (step: BotStep<TState, TMove>) => void,
): BotRun {
  let state = game.create(options.seed, options.difficulty);
  let rng = seedRng(options.seed ^ 0x5bd1e995);
  for (let played = 0; played < options.maxMoves; played += 1) {
    const outcome = game.outcome(state);
    const moves = game.listMoves(state);
    if (outcome.kind !== 'playing' || moves.length === 0) return { outcome, moves: played };
    const choice = options.policy(state, moves, rng);
    rng = choice.rng;
    onStep({ state, move: choice.move });
    state = game.applyMove(state, choice.move).state;
  }
  return { outcome: game.outcome(state), moves: options.maxMoves };
}

/** Plays one game headless. Same seed + same policy = same game, on every machine. */
export function playBot<TState, TMove, TEvent>(
  game: BotGame<TState, TMove, TEvent>,
  options: BotOptions<TState, TMove>,
): BotRun {
  return runBot(game, options, () => undefined);
}

/**
 * playBot's game with every step it played, in order (the state before each move): tools that
 * show a bot's line, such as e2e-maestro's print-level-line, read it instead of copying the loop
 * and its seed rule.
 */
export function playBotLine<TState, TMove, TEvent>(
  game: BotGame<TState, TMove, TEvent>,
  options: BotOptions<TState, TMove>,
): BotRun & { readonly line: readonly BotStep<TState, TMove>[] } {
  const line: BotStep<TState, TMove>[] = [];
  const run = runBot(game, options, (step) => {
    line.push(step);
  });
  return { ...run, line };
}
