// apps/halo-drift/src/sim/halo-drift-sim.test.ts
import {
  createHaloDriftSim,
  drainHaloDriftEvents,
  EVENT_INPUT,
  EVENT_SPARK,
  haloDriftOutcome,
  haloDriftScore,
  stepHaloDriftSim,
} from './halo-drift-sim.ts';

import type { HaloDriftSim } from './halo-drift-sim.ts';

type Recording = { readonly tick: number; readonly command: number };

const EAST = 1;

function fingerprint(sim: HaloDriftSim): string {
  return `${Array.from(sim.body).join(',')}|${Array.from(sim.ints.subarray(0, 8)).join(',')}`;
}

/** Plays `ticks` ticks in frames of 1 to 3 ticks and keeps the (tick, command) log it drains. */
function play(seed: number, ticks: number, commandAt: (tick: number) => number) {
  const sim = createHaloDriftSim(seed, 34);
  const inputs: Recording[] = [];
  let tick = 0;
  while (tick < ticks) {
    for (let step = 0; step < 1 + (tick % 3) && tick < ticks; step += 1, tick += 1)
      stepHaloDriftSim(sim, commandAt(tick));
    const events = drainHaloDriftEvents(sim);
    for (let at = 0; at < events.length; at += 3) {
      if (events[at] === EVENT_INPUT)
        inputs.push({ command: events[at + 1] ?? 0, tick: events[at + 2] ?? 0 });
    }
  }
  return { sim, inputs };
}

describe('halo drift sim', () => {
  it('starts in play with the first spark within reach of a straight push', () => {
    const sim = createHaloDriftSim(1, 0);
    expect(haloDriftOutcome(sim)).toStrictEqual({ kind: 'playing' });
    let tick = 0;
    while (haloDriftScore(sim) === 0 && tick < 120) {
      stepHaloDriftSim(sim, EAST);
      tick += 1;
    }
    expect(haloDriftScore(sim)).toBe(1);
    expect(drainHaloDriftEvents(sim)).toContain(EVENT_SPARK);
  });

  it('replays a recorded run exactly from its (tick, command) log', () => {
    const recorded = play(7, 1200, (tick) => (tick >> 5) % 17);
    const replay = createHaloDriftSim(7, 34);
    let command = 0;
    let next = 0;
    for (let tick = 0; tick < 1200; tick += 1) {
      if (recorded.inputs[next]?.tick === tick) {
        command = recorded.inputs[next]?.command ?? 0;
        next += 1;
      }
      stepHaloDriftSim(replay, command);
    }
    expect(fingerprint(replay)).toBe(fingerprint(recorded.sim));
  });

  it('gives the same result however ticks are grouped into frames', () => {
    const steer = (tick: number): number => (tick * 7) % 17;
    const single = createHaloDriftSim(3, 34);
    for (let tick = 0; tick < 900; tick += 1) stepHaloDriftSim(single, steer(tick));
    expect(fingerprint(play(3, 900, steer).sim)).toBe(fingerprint(single));
  });

  it('stops changing once the run is over', () => {
    const sim = createHaloDriftSim(2, 67);
    for (let tick = 0; tick < 2000; tick += 1) stepHaloDriftSim(sim, 0);
    expect(haloDriftOutcome(sim)).toStrictEqual({
      kind: 'lost',
      reasonKey: 'halo-drift.lose.out-of-hearts',
    });
    const before = fingerprint(sim);
    stepHaloDriftSim(sim, EAST);
    expect(fingerprint(sim)).toBe(before);
  });
});
