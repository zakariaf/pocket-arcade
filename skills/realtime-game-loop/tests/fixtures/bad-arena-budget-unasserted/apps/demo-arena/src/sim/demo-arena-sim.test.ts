// apps/demo-arena/src/sim/demo-arena-sim.test.ts
import { commandLog, replayCommands } from '@e07/game-kit/testing/replay-commands.ts';

import {
  createDemoArenaSim,
  drainDemoArenaEvents,
  EVENT_INPUT,
  simTick,
  stepDemoArenaSim,
} from './demo-arena-sim.ts';

import type { DemoArenaSim } from './demo-arena-sim.ts';

const ENTITIES = 20;

/** Every number that defines the world: bodies, header and RNG words. */
function fingerprint(sim: DemoArenaSim): string {
  return `${Array.from(sim.body).join(',')}|${Array.from(sim.ints.subarray(0, 3)).join(',')}|${Array.from(sim.rng).join(',')}`;
}

/** Plays `ticks` ticks grouped into frames of 1–3 ticks, like a real display, recording inputs. */
function play(seed: number, ticks: number, commandAt: (tick: number) => number) {
  const sim = createDemoArenaSim(seed, ENTITIES);
  const events: number[] = [];
  let tick = 0;
  while (tick < ticks) {
    const frameSteps = 1 + (tick % 3);
    for (let s = 0; s < frameSteps && tick < ticks; s += 1, tick += 1) {
      stepDemoArenaSim(sim, commandAt(tick));
    }
    events.push(...drainDemoArenaEvents(sim));
  }
  return { sim, log: commandLog(events, EVENT_INPUT) };
}

describe('demo-arena simulation', () => {
  it('replays a recorded run exactly from its (tick, command) log', () => {
    const recorded = play(7, 1200, (tick) => (tick >> 5) % 17);
    const replayed = replayCommands(
      { sim: createDemoArenaSim(7, ENTITIES), step: stepDemoArenaSim, ticks: 1200 },
      recorded.log,
    );
    expect(fingerprint(replayed)).toBe(fingerprint(recorded.sim));
  });

  it('gives the same world however ticks are grouped into frames (60 vs 120 Hz)', () => {
    const bot = (tick: number): number => (tick * 7) % 17;
    const grouped = play(3, 900, bot).sim;
    const single = createDemoArenaSim(3, ENTITIES);
    for (let tick = 0; tick < 900; tick += 1) stepDemoArenaSim(single, bot(tick));
    expect(fingerprint(single)).toBe(fingerprint(grouped));
  });

  it('counts time in ticks and drains events once', () => {
    const sim = createDemoArenaSim(1, ENTITIES);
    stepDemoArenaSim(sim, 5);
    expect(simTick(sim)).toBe(1);
    expect(drainDemoArenaEvents(sim).slice(0, 3)).toStrictEqual([EVENT_INPUT, 5, 0]);
    expect(drainDemoArenaEvents(sim)).toStrictEqual([]);
  });
});
