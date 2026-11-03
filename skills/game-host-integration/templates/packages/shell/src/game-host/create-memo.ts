// packages/shell/src/game-host/create-memo.ts
// One create() per (seed, difficulty) for every run a host opens: a run asks for its start when it
// opens, when a saved run is replayed at boot or on resume, when a level is retried and when its
// counters are measured at the run end. Games whose create proves a board winnable (a solver or a
// witness) pay that proof once instead of at every one of those moments.
import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';

/** How many recent starts a host keeps: the open run's, a retried level's and a few before. */
export const CREATE_MEMO_SIZE = 8;

type Create<TState> = (seed: number, difficulty: number) => TState;

type Remembered<TState> = { readonly key: string; readonly state: TState };

/**
 * create() remembered per (seed, difficulty), the most recently asked first. Only a memo: the game
 * contract makes create pure and never changes a state in place (applyMove builds new ones), so a
 * remembered state is the one create would build again, on every phone.
 */
export function memoizeCreate<TState>(create: Create<TState>): Create<TState> {
  let recent: readonly Remembered<TState>[] = [];
  return (seed, difficulty) => {
    const key = `${String(seed)}:${String(difficulty)}`;
    const hit = recent.find((entry) => entry.key === key);
    const entry = hit ?? { key, state: create(seed, difficulty) };
    recent = [entry, ...recent.filter((other) => other !== hit)].slice(0, CREATE_MEMO_SIZE);
    return entry.state;
  };
}

/** The same module with a memoized engine create (createGameHost opens every run through it). */
export function withCreateMemo<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
): ShellGameModule<T> {
  return { ...game, engine: { ...game.engine, create: memoizeCreate(game.engine.create) } };
}
