// apps/__GAME_ID__/src/sim/__GAME_ID__-sim.test.ts
import { commandLog, replayCommands } from '@e07/game-kit/testing/replay-commands.ts';

import {
  create__GAME_PASCAL__Sim,
  drain__GAME_PASCAL__Events,
  EVENT_INPUT,
  simTick,
  step__GAME_PASCAL__Sim,
} from './__GAME_ID__-sim.ts';

import type { __GAME_PASCAL__Sim } from './__GAME_ID__-sim.ts';

const ENTITIES = 20;

/** Every number that defines the world: bodies, header and RNG words. */
function fingerprint(sim: __GAME_PASCAL__Sim): string {
  return `${Array.from(sim.body).join(',')}|${Array.from(sim.ints.subarray(0, 3)).join(',')}|${Array.from(sim.rng).join(',')}`;
}

/** Plays `ticks` ticks grouped into frames of 1–3 ticks, like a real display, recording inputs. */
function play(seed: number, ticks: number, commandAt: (tick: number) => number) {
  const sim = create__GAME_PASCAL__Sim(seed, ENTITIES);
  const events: number[] = [];
  let tick = 0;
  while (tick < ticks) {
    const frameSteps = 1 + (tick % 3);
    for (let s = 0; s < frameSteps && tick < ticks; s += 1, tick += 1) {
      step__GAME_PASCAL__Sim(sim, commandAt(tick));
    }
    events.push(...drain__GAME_PASCAL__Events(sim));
  }
  return { sim, log: commandLog(events, EVENT_INPUT) };
}

describe('__GAME_ID__ simulation', () => {
  it('replays a recorded run exactly from its (tick, command) log', () => {
    const recorded = play(7, 1200, (tick) => (tick >> 5) % 17);
    const replayed = replayCommands(
      { sim: create__GAME_PASCAL__Sim(7, ENTITIES), step: step__GAME_PASCAL__Sim, ticks: 1200 },
      recorded.log,
    );
    expect(fingerprint(replayed)).toBe(fingerprint(recorded.sim));
  });

  it('gives the same world however ticks are grouped into frames (60 vs 120 Hz)', () => {
    const bot = (tick: number): number => (tick * 7) % 17;
    const grouped = play(3, 900, bot).sim;
    const single = create__GAME_PASCAL__Sim(3, ENTITIES);
    for (let tick = 0; tick < 900; tick += 1) step__GAME_PASCAL__Sim(single, bot(tick));
    expect(fingerprint(single)).toBe(fingerprint(grouped));
  });

  it('counts time in ticks and drains events once', () => {
    const sim = create__GAME_PASCAL__Sim(1, ENTITIES);
    step__GAME_PASCAL__Sim(sim, 5);
    expect(simTick(sim)).toBe(1);
    expect(drain__GAME_PASCAL__Events(sim).slice(0, 3)).toStrictEqual([EVENT_INPUT, 5, 0]);
    expect(drain__GAME_PASCAL__Events(sim)).toStrictEqual([]);
  });
});
