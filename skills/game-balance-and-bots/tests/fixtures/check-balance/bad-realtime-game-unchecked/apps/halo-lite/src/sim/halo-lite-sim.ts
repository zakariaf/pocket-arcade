// apps/halo-lite/src/sim/halo-lite-sim.ts
'worklet';

export function stepHaloLite(sim: { tick: number }): void {
  sim.tick += 1;
}
