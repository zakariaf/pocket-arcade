// packages/tooling/src/e2e/simulator.test.ts
// The pure parts of the simulator helpers: which simulator a run uses (--sim) and what a failed
// boot tells the reader to do. The simctl calls themselves run only on a Mac (npm run e2e:ios).
import {
  bootFailureMessage,
  debugSetupArgs,
  e2eSimulatorName,
  e2eTabletName,
} from './simulator.ts';

describe('e2eTabletName', () => {
  it("names this session's own iPad after --sim, or keeps the shared default", () => {
    expect(e2eTabletName(undefined, 'e07-e2e-tablet')).toBe('e07-e2e-tablet');
    expect(e2eTabletName('r3-e2e', 'e07-e2e-tablet')).toBe('e07-r3-e2e-tablet');
    expect(e2eTabletName('e07-r3-e2e', 'e07-e2e-tablet')).toBe('e07-r3-e2e-tablet');
  });
});

describe('e2eSimulatorName', () => {
  it('uses the default phone simulator without --sim', () => {
    expect(e2eSimulatorName(undefined, 'e07-e2e-phone')).toBe('e07-e2e-phone');
  });

  it("names the session's own simulator e07-<purpose>, and keeps an e07- name", () => {
    expect(e2eSimulatorName('r3-e2e', 'e07-e2e-phone')).toBe('e07-r3-e2e');
    expect(e2eSimulatorName('e07-r3-e2e', 'e07-e2e-phone')).toBe('e07-r3-e2e');
  });

  it('refuses a name that is not a kebab-case purpose', () => {
    expect(() => e2eSimulatorName('iPhone 17', 'e07-e2e-phone')).toThrow('kebab-case purpose');
  });
});

describe('bootFailureMessage', () => {
  it("says to shut down only this session's own e07 simulators when the Mac is full", () => {
    const stderr =
      'Unable to boot device due to insufficient system resources. maxUserProcs: 2666, runningUserProcs: 2436';
    const message = bootFailureMessage('e07-e2e-phone', stderr) ?? '';
    expect(message).toContain("Shut down this session's own e07-* simulators");
    expect(message).toContain("never another session's");
    expect(message).toContain('--sim <purpose>');
  });

  it('leaves other boot failures as they are', () => {
    expect(bootFailureMessage('e07-e2e-phone', 'Invalid device state')).toBeNull();
  });
});

describe('debugSetupArgs', () => {
  it('applies one debug link through the setup sub-flow, never simctl openurl', () => {
    const app = {
      path: 'LineSiege.app',
      id: 'com.example.linesiege',
      scheme: 'e07-line-siege',
      name: 'LineSiege',
    };
    expect(
      debugSetupArgs({
        udid: 'U1',
        app,
        query: 'firstRun=0&screen=home',
        waitFor: 'home.screen',
        outDir: 'out',
      }),
    ).toStrictEqual([
      ...[
        'test',
        'packages/shell/e2e/subflows/debug-setup.yaml',
        '--udid',
        'U1',
        '--test-output-dir',
        'out',
      ],
      ...['-e', 'APP_ID=com.example.linesiege', '-e', 'APP_SCHEME=e07-line-siege'],
      ...['-e', 'QUERY=firstRun=0&screen=home', '-e', 'WAIT_FOR=home.screen'],
    ]);
  });
});
