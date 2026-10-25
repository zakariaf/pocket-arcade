// packages/game-kit/src/testing/replay-commands.test.ts
import { commandLog, replayCommands } from './replay-commands.ts';

type Recorder = { readonly seen: number[] };

const step = (sim: Recorder, command: number): void => {
  sim.seen.push(command);
};

describe('replay helpers', () => {
  it('extracts (tick, command) changes from drained event triples', () => {
    expect(commandLog([1, 4, 0, 2, 9, 3, 1, 0, 7], 1)).toStrictEqual([
      { command: 4, tick: 0 },
      { command: 0, tick: 7 },
    ]);
  });

  it('feeds each command from its tick until the next change', () => {
    const sim = replayCommands({ sim: { seen: [] }, step, ticks: 5 }, [
      { tick: 1, command: 3 },
      { tick: 3, command: 1 },
    ]);
    expect(sim.seen).toStrictEqual([0, 3, 3, 1, 1]);
  });

  it('applies every change logged on one tick, the last one winning, and goes on after it', () => {
    const sim = replayCommands({ sim: { seen: [] }, step, ticks: 5 }, [
      { tick: 1, command: 3 },
      { tick: 1, command: 5 },
      { tick: 3, command: 1 },
    ]);
    expect(sim.seen).toStrictEqual([0, 5, 5, 1, 1]);
  });

  it('refuses a log whose ticks go backwards', () => {
    const input = { sim: { seen: [] }, step, ticks: 5 };
    const log = [
      { tick: 3, command: 1 },
      { tick: 1, command: 3 },
    ];
    expect(() => replayCommands(input, log)).toThrow(RangeError);
  });
});
