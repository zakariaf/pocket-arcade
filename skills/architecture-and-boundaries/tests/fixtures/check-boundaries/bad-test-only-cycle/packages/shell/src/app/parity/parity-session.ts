// packages/shell/src/app/parity/parity-session.ts
let frameState: string | null = null;

/** The frame state a parity capture asked for (test builds only). */
export function parityFrameState(): string | null {
  return frameState;
}

/** Starts a parity session for one frame. */
export function startParitySession(state: string | null): void {
  frameState = state;
}
