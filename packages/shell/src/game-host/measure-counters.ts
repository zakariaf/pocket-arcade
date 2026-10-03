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

/** Re-applies one saved log entry: a move, or the game's one-time continue. */
function replayEntry<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  state: TState,
  entry: RunLogEntry<TMove>,
): ApplyResult<TState, TEvent> {
  if (entry.kind === 'move') return rules.applyMove(state, entry.move);
  return rules.continueRun.kind === 'once' ? rules.continueRun.apply(state) : { state, events: [] };
}

/**
 * A finished run's game counters (spec 10 STATISTICS, S10). Replays the kept move line from
 * create(seed, difficulty) and folds each counter over every move's events: undone moves never
 * count, and a run resumed after a kill measures exactly what the player kept.
 */
export function measureCounters<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  session: Pick<GameSession<TState, TMove, TEvent>, 'seed' | 'difficulty' | 'log'>,
  counters: readonly CounterSpec<TEvent>[],
): CounterTally {
  let state = rules.create(session.seed, session.difficulty);
  let tally = fold({}, counters, []);
  for (const entry of session.log) {
    const result = replayEntry(rules, state, entry);
    tally = fold(tally, counters, result.events);
    state = result.state;
  }
  return tally;
}
