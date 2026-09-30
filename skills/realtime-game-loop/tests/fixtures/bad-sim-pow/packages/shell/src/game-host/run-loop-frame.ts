// packages/shell/src/game-host/run-loop-frame.ts
'worklet';

import { scheduleOnRN } from 'react-native-worklets';

import { planSteps } from '@e07/game-kit/timeline/fixed-step.ts';

import { describeError } from './describe-error.ts';

import type { SharedValue } from 'react-native-reanimated';

/** Everything the real-time loop's frame callback needs; JS callbacks arrive via scheduleOnRN. */
export type LoopFrameWiring<TSim> = {
  readonly sim: SharedValue<TSim>;
  readonly command: SharedValue<number>;
  readonly accMs: SharedValue<number>;
  readonly step: (sim: TSim, command: number) => void;
  readonly drainEvents: (sim: TSim) => readonly number[];
  readonly onEvents: (events: readonly number[]) => void;
  readonly onError: (message: string) => void;
};

export function runLoopFrame<TSim>(wiring: LoopFrameWiring<TSim>, frameDtMs: number | null): void {
  try {
    const plan = planSteps(wiring.accMs.get(), frameDtMs);
    wiring.accMs.set(plan.accMs);
    if (plan.steps === 0) return;
    const input = wiring.command.get();
    const state = wiring.sim.get(); // on the UI thread: the live object, not a copy
    for (let i = 0; i < plan.steps; i += 1) wiring.step(state, input);
    const events = wiring.drainEvents(state);
    wiring.sim.modify(); // mutated in place: force listeners (the board picture) to re-run
    if (events.length > 0) scheduleOnRN(wiring.onEvents, events);
  } catch (error) {
    scheduleOnRN(wiring.onError, describeError(error));
  }
}
