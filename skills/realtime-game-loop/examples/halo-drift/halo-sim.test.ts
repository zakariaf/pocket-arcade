// apps/halo-drift/src/sim/halo-sim.test.ts
import { EVENT_INPUT, createHaloSim, drainHaloEvents, stepHaloSim } from './halo-sim.ts';

import type { HaloSim } from './halo-sim.ts';

type Recording = { readonly tick: number; readonly command: number };

function fingerprint(sim: HaloSim): string {
  return `${Array.from(sim.body).join(',')}|${Array.from(sim.ints.subarray(0, 3)).join(',')}`;
}

/** Plays `ticks` ticks, grouping them into "frames" of varying size like a real display would. */
function play(
  seed: number,
  ticks: number,
  commandAt: (tick: number) => number,
): { sim: HaloSim; inputs: Recording[] } {
  const sim = createHaloSim(seed, 20);
  const inputs: Recording[] = [];
  let tick = 0;
  while (tick < ticks) {
    const frameSteps = 1 + (tick % 3);
    for (let s = 0; s < frameSteps && tick < ticks; s += 1, tick += 1)
      stepHaloSim(sim, commandAt(tick));
    const events = drainHaloEvents(sim);
    for (let e = 0; e < events.length; e += 3) {
      if (events[e] === EVENT_INPUT)
        inputs.push({ command: events[e + 1] ?? 0, tick: events[e + 2] ?? 0 });
    }
  }
  return { sim, inputs };
}

function replay(seed: number, ticks: number, inputs: readonly Recording[]): HaloSim {
  const sim = createHaloSim(seed, 20);
  let command = 0;
  let next = 0;
  for (let tick = 0; tick < ticks; tick += 1) {
    const change = inputs[next];
    if (change?.tick === tick) {
      command = change.command;
      next += 1;
    }
    stepHaloSim(sim, command);
  }
  return sim;
}

describe('halo drift simulation', () => {
  it('replays a recorded run exactly from its (tick, command) log', () => {
    const recorded = play(7, 1200, (tick) => (tick >> 5) % 17);
    expect(fingerprint(replay(7, 1200, recorded.inputs))).toBe(fingerprint(recorded.sim));
  });

  it('gives the same result however ticks are grouped into frames', () => {
    const bot = (tick: number): number => (tick * 7) % 17;
    const grouped = play(3, 900, bot).sim;
    const single = createHaloSim(3, 20);
    for (let tick = 0; tick < 900; tick += 1) stepHaloSim(single, bot(tick));
    expect(fingerprint(single)).toBe(fingerprint(grouped));
  });
});
