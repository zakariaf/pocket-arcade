// packages/shell/src/game-host/measure-counters.ts
import type { ApplyResult } from '@e07/game-kit/contract/game-engine.ts';
import type { CounterSpec } from '@e07/game-kit/contract/stats.ts';
import type {
  GameSession,
  RunLogEntry,
  SessionRules,
} from '@e07/shell/game-host/game-session-types.ts';

/** One counter's result for a finished run, in the shape the statistics model folds in. */
export type CounterValue = { readonly value: number; readonly aggregate: 'sum' | 'max' };

export type CounterTally = Readonly<Record<string, CounterValue>>;

function fold<TEvent>(
  tally: CounterTally,
  counters: readonly CounterSpec<TEvent>[],
  events: readonly TEvent[],
): CounterTally {
  const next: Record<string, CounterValue> = { ...tally };
  for (const counter of counters) {
    const measured = counter.measure(events);
    const previous = next[counter.id]?.value ?? 0;
    const value = counter.aggregate === 'sum' ? previous + measured : Math.max(previous, measured);
    next[counter.id] = { value, aggregate: counter.aggregate };
  }
  return next;
}

/**
 * Every counter at 0 (its aggregate kept): what a run end records when its kept move line cannot
 * be replayed from create(seed, difficulty), so nothing about its counters is knowable.
 */
export function noCounters<TEvent>(counters: readonly CounterSpec<TEvent>[]): CounterTally {
  return fold({}, counters, []);
}

/** Re-applies one saved log entry: a move, or the game's one-time continue. */
function replayEntry<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  state: TState,
  entry: RunLogEntry<TMove>,
): ApplyResult<TState, TEvent> {
  if (entry.kind === 'move') return rules.applyMove(state, entry.move);
  return rules.continueRun.kind === 'once' ? rules.continueRun.apply(state) : { state, events: [] };
}

/** True when the game's continue takes the losing move back (ContinuePolicy isTakeBack). */
function isTakeBackContinue<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
): boolean {
  return rules.continueRun.kind === 'once' && rules.continueRun.isTakeBack === true;
}

/**
 * A finished run's game counters (spec 10 STATISTICS, S10). Replays the kept move line from
 * create(seed, difficulty) and folds each counter over every move's events: undone moves never
 * count, a continue that takes the losing move back drops that move's counts (sums and maxima),
 * and a run resumed after a kill measures exactly what the player kept.
 */
export function measureCounters<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  session: Pick<GameSession<TState, TMove, TEvent>, 'seed' | 'difficulty' | 'log'>,
  counters: readonly CounterSpec<TEvent>[],
): CounterTally {
  let state = rules.create(session.seed, session.difficulty);
  let tally = noCounters(counters);
  // The tally as it stood before the last replayed move: what a take-back continue goes back to.
  let beforeLastMove = tally;
  for (const entry of session.log) {
    const result = replayEntry(rules, state, entry);
    const isTakenBack = entry.kind === 'continue' && isTakeBackContinue(rules);
    if (entry.kind === 'move') beforeLastMove = tally;
    tally = fold(isTakenBack ? beforeLastMove : tally, counters, result.events);
    state = result.state;
  }
  return tally;
}
