// packages/tooling/src/e2e/airplane-mode.test.ts
import { underAirplaneMode, type AirplaneMode } from './airplane-mode.ts';

/** A scripted device: each airplane call answers its mode's exit code; every call is recorded. */
function scripted(codes: Readonly<Record<AirplaneMode, number>>): {
  readonly calls: string[];
  readonly airplane: (mode: AirplaneMode) => Promise<number>;
  readonly flows: (status: number) => () => Promise<number>;
} {
  const calls: string[] = [];
  return {
    calls,
    airplane: (mode) => {
      calls.push(`airplane ${mode}`);
      return Promise.resolve(codes[mode]);
    },
    flows: (status) => () => {
      calls.push('flows');
      return Promise.resolve(status);
    },
  };
}

describe('underAirplaneMode', () => {
  it('runs the offline flows between airplane mode on and off, with their exit code', async () => {
    const device = scripted({ enabled: 0, disabled: 0 });
    await expect(underAirplaneMode(device.airplane, device.flows(1))).resolves.toBe(1);
    expect(device.calls).toStrictEqual(['airplane enabled', 'flows', 'airplane disabled']);
  });

  it('turns airplane mode off even when the run that turns it on fails, and skips the flows', async () => {
    const device = scripted({ enabled: 1, disabled: 0 });
    await expect(underAirplaneMode(device.airplane, device.flows(0))).resolves.toBe(1);
    expect(device.calls).toStrictEqual(['airplane enabled', 'airplane disabled']);
  });

  it('turns airplane mode off when the flows throw', async () => {
    const device = scripted({ enabled: 0, disabled: 0 });
    const flows = (): Promise<number> => Promise.reject(new Error('maestro did not start'));
    await expect(underAirplaneMode(device.airplane, flows)).rejects.toThrow(
      'maestro did not start',
    );
    expect(device.calls).toStrictEqual(['airplane enabled', 'airplane disabled']);
  });

  it('fails the step when airplane mode could not be turned off: later flows would run offline', async () => {
    const device = scripted({ enabled: 0, disabled: 1 });
    await expect(underAirplaneMode(device.airplane, device.flows(0))).resolves.toBe(1);
    expect(device.calls).toStrictEqual(['airplane enabled', 'flows', 'airplane disabled']);
  });
});
