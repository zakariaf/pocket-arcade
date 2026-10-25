// packages/game-kit/src/testing/replay-commands.ts
// Test helpers for real-time sims: turn drained event triples into a (tick, command) log, and
// replay a log tick by tick. A recorded run must replay bit-exactly, however frames grouped ticks.

/** One recorded input change: from `tick` on, the stick command is `command`. */
export type CommandChange = { readonly tick: number; readonly command: number };

/** Picks the input changes out of drained [kind, value, tick, …] triples. */
export function commandLog(events: readonly number[], inputKind: number): CommandChange[] {
  const log: CommandChange[] = [];
  for (let e = 0; e + 2 < events.length; e += 3) {
    if (events[e] === inputKind)
      log.push({ command: events[e + 1] ?? 0, tick: events[e + 2] ?? 0 });
  }
  return log;
}

/** What a replay needs: the sim to advance, its step function and how many ticks to run. */
export type ReplayInput<TSim> = {
  readonly sim: TSim;
  readonly step: (sim: TSim, command: number) => void;
  readonly ticks: number;
};

/**
 * Steps `sim` in place for `ticks` ticks, applying each logged command from its tick on. Every
 * change due by a tick is applied before it (several on one tick: the last one wins). A log whose
 * ticks go backwards was not recorded by a sim, so it throws a RangeError instead of replaying.
 */
export function replayCommands<TSim>(
  input: ReplayInput<TSim>,
  log: readonly CommandChange[],
): TSim {
  log.forEach((change, index) => {
    const before = log[index - 1];
    if (before !== undefined && change.tick < before.tick) {
      throw new RangeError(`command log goes back in time at entry ${String(index)}`);
    }
  });
  let command = 0;
  let next = 0;
  for (let tick = 0; tick < input.ticks; tick += 1) {
    for (let change = log[next]; change !== undefined && change.tick <= tick; change = log[next]) {
      command = change.command;
      next += 1;
    }
    input.step(input.sim, command);
  }
  return input.sim;
}
