// packages/game-kit/src/testing/check-property.ts
import fc from 'fast-check';

/** Runs a property 100 times. */
export function checkProperty(run: (seed: number) => boolean): void {
  fc.assert(fc.property(fc.integer(), run));
}
