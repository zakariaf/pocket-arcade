// packages/tooling/src/e2e/airplane-mode.ts
// e2e:android's offline journeys run under real airplane mode (subflows/airplane-mode.yaml through
// Maestro). The order around them, pure: the device calls are passed in.

export type AirplaneMode = 'enabled' | 'disabled';

/**
 * Runs `flows` with airplane mode on and turns it off again whatever happens: a failed 'enabled'
 * run may still have switched it on (the flows are then skipped), and flows that throw still get
 * the 'disabled' run. A failed 'disabled' run fails the step, because every later flow of the run
 * would be offline. Resolves the step's exit code (0 only when all three passed).
 */
export async function underAirplaneMode(
  airplane: (mode: AirplaneMode) => Promise<number>,
  flows: () => Promise<number>,
): Promise<number> {
  let status = 1;
  try {
    if ((await airplane('enabled')) === 0) status = await flows();
  } finally {
    if ((await airplane('disabled')) !== 0) status = 1;
  }
  return status;
}
