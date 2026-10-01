// packages/tooling/src/e2e/simulator.test.ts
// The pure parts of the simulator helpers: which simulator a run uses (--sim), what a failed boot
// tells the reader to do, and that every Maestro run names its device and driver port before the
// command (a stand-in maestro binary records its arguments). The simctl calls themselves run only
// on a Mac (npm run e2e:ios).
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  bootFailureMessage,
  debugSetupArgs,
  e2eSimulatorName,
  e2eTabletName,
  e2eBuildProblem,
  runMaestro,
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
  it('applies one debug link through the setup sub-flow, never simctl openurl, with no device of its own', () => {
    const app = {
      path: 'LineSiege.app',
      id: 'io.applander.linesiege',
      scheme: 'e07-line-siege',
      name: 'LineSiege',
    };
    const args = debugSetupArgs({
      app,
      query: 'firstRun=0&screen=home',
      waitFor: 'home.screen',
      outDir: 'out',
    });
    expect(args).toStrictEqual([
      ...['test', 'packages/shell/e2e/subflows/debug-setup.yaml', '--test-output-dir', 'out'],
      ...['-e', 'APP_ID=io.applander.linesiege', '-e', 'APP_SCHEME=e07-line-siege'],
      ...['-e', 'QUERY=firstRun=0&screen=home', '-e', 'WAIT_FOR=home.screen'],
    ]);
    expect(args).not.toContain('--udid');
  });
});

describe('runMaestro', () => {
  const udid = '0C9E3F8A-51D2-4B7E-9A61-2F4D8C7B1E03';
  const cwd = process.cwd();
  let repo = '';
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'run-maestro-'));
    mkdirSync(join(repo, 'tools', 'maestro', 'bin'), { recursive: true });
    const maestro = join(repo, 'tools', 'maestro', 'bin', 'maestro');
    writeFileSync(maestro, '#!/bin/sh\nprintf "%s\\n" "$@" >> args.txt\n');
    chmodSync(maestro, 0o755);
    process.chdir(repo);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.chdir(cwd);
    rmSync(repo, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  const argsOfRuns = (): string[][] =>
    readFileSync(join(repo, 'args.txt'), 'utf8')
      .trim()
      .split('\n--device\n')
      .map((run) => run.replace(/^--device\n/, '').split('\n'));

  it('names the device and a free driver port before the command, a new port per run', async () => {
    await expect(runMaestro({ udid }, ['test', 'a.yaml'])).resolves.toBe(0);
    await expect(runMaestro({ udid }, ['test', 'b.yaml'])).resolves.toBe(0);
    const [first, second] = argsOfRuns();
    expect(first?.[0]).toBe(udid);
    expect(first?.[1]).toBe('--driver-host-port');
    expect(first?.slice(3)).toStrictEqual(['test', 'a.yaml']);
    expect(second?.slice(3)).toStrictEqual(['test', 'b.yaml']);
    expect(Number(first?.[2])).toBeGreaterThanOrEqual(1024);
  });

  it("keeps the session's own driver port", async () => {
    await runMaestro({ udid, driverPort: 61_234 }, ['hierarchy']);
    expect(argsOfRuns()).toStrictEqual([[udid, '--driver-host-port', '61234', 'hierarchy']]);
  });

  it('refuses "booted" before Maestro starts', async () => {
    await expect(runMaestro({ udid: 'booted' }, ['test', 'a.yaml'])).rejects.toThrow(
      'is not a simulator UDID',
    );
  });
});

describe('e2eBuildProblem', () => {
  it('accepts only a test build with ads off (no consent form, tracking prompt or ad socket)', () => {
    expect(e2eBuildProblem({ appVariant: 'test', adsMode: 'off' }, 'line-siege')).toBeNull();
  });

  it.each([
    ['test', 'test'],
    ['store', 'off'],
    ['store', 'live'],
    [undefined, undefined],
  ])('refuses a %s/%s build and says how to build the right one', (appVariant, adsMode) => {
    expect(e2eBuildProblem({ appVariant, adsMode }, 'line-siege')).toBe(
      `e2e:ios needs a test build with ADS_MODE=off, this one is ${String(appVariant)}/${String(adsMode)}: run npm run build:ios:sim -- --app line-siege --variant test --ads off`,
    );
  });
});
