// packages/game-kit/src/contract/realtime.ts
import type { SavePoint } from '@e07/game-kit/contract/persistence.ts';

/**
 * Continuous games only (Halo Drift). Turn-based and simulate-then-replay games set
 * `realtime: null`. `step` and `drainEvents` match the Shell's FixedStepSim
 * (use-fixed-step-loop.ts), so the module can be handed to useFixedStepLoop unchanged.
 */
export type RealtimeSpec<TState, TSim> = {
  /** JS: build the typed-array sim from a fresh or saved state. */
  readonly createSim: (state: TState) => TSim;
  /** Worklet: one tick with the current integer command; mutates `sim` in place. */
  readonly step: (sim: TSim, command: number) => void;
  /** Worklet: copy out and clear this frame's events as a flat int list. */
  readonly drainEvents: (sim: TSim) => readonly number[];
  /** JS: JSON snapshot of a sim copy (`sim.get()`), taken only at save points. */
  readonly snapshot: (sim: TSim) => TState;
  readonly savePoints: readonly SavePoint[];
  /** JS: true when a drained batch contains a save-point event (e.g. wave end). */
  readonly isSavePoint: (events: readonly number[]) => boolean;
};
