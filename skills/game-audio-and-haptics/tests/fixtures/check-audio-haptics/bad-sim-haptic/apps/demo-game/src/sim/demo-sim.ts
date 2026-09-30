// apps/demo-game/src/sim/demo-sim.ts
'worklet';

export function stepDemo(sim: { hits: number }, haptics: { play: (cue: 'heavy') => void }): void {
  sim.hits += 1;
  haptics.play('heavy');
}
