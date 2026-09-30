// packages/tooling/src/build/sim-build-plan.test.ts
import {
  buildScriptProblems,
  builtAppPath,
  isHelpRequest,
  isStaleDerivedData,
  linkProblems,
  linkScreenshotPath,
  linkSetupArgs,
  linkWaitFor,
  moduleCachePathIn,
  parseSimBuildArgs,
  readyReason,
  recordedRepoRoot,
  schemeOf,
  screenshotPath,
  scriptTargetsOf,
  SIM_BUILD_USAGE,
  variantEnv,
  xcodebuildSimArgs,
} from './sim-build-plan.ts';

describe('buildScriptProblems (the preflight before prebuild)', () => {
  const AUDIT = 'node packages/tooling/src/audit/audit-privacy.ts';

  it('passes when audit:privacy and its file exist', () => {
    const exists = (path: string): boolean =>
      path === 'packages/tooling/src/audit/audit-privacy.ts';
    expect(buildScriptProblems({ 'audit:privacy': AUDIT }, exists)).toStrictEqual([]);
  });

  it('names the missing file and the skill that ships it', () => {
    const [problem] = buildScriptProblems({ 'audit:privacy': AUDIT }, () => false);
    expect(problem).toContain('"audit:privacy" runs packages/tooling/src/audit/audit-privacy.ts');
    expect(problem).toContain("privacy-and-network-audit's tooling templates");
  });

  it('fails when the script itself is missing', () => {
    expect(buildScriptProblems({}, () => true)).toStrictEqual([
      expect.stringContaining('package.json has no "audit:privacy" script'),
    ]);
  });

  it('reads only the file arguments of a command', () => {
    expect(scriptTargetsOf(`${AUDIT} --app line-siege`)).toStrictEqual([
      'packages/tooling/src/audit/audit-privacy.ts',
    ]);
    expect(scriptTargetsOf('npx expo prebuild --clean')).toStrictEqual([]);
  });
});

describe('parseSimBuildArgs', () => {
  it('defaults to a test build with test ads on the smoke simulator', () => {
    expect(parseSimBuildArgs(['--app', 'line-siege'])).toStrictEqual({
      game: 'line-siege',
      variant: { appVariant: 'test', adsMode: 'test' },
      purpose: 'smoke',
      link: null,
    });
  });

  it('defaults a store build to live ads', () => {
    const options = parseSimBuildArgs(['--app', 'line-siege', '--variant', 'store']);
    expect(options.variant).toStrictEqual({ appVariant: 'store', adsMode: 'live' });
  });

  it('accepts ads off and another simulator purpose', () => {
    const options = parseSimBuildArgs(['--app', 'line-siege', '--ads', 'off', '--sim', 'e2e']);
    expect(options.variant.adsMode).toBe('off');
    expect(options.purpose).toBe('e2e');
  });

  it.each([
    ['test', 'live'],
    ['store', 'test'],
  ])('rejects the forbidden pair %s + %s', (variant, ads) => {
    expect(() =>
      parseSimBuildArgs(['--app', 'line-siege', '--variant', variant, '--ads', ads]),
    ).toThrow('is not allowed');
  });

  it('requires --app', () => {
    expect(() => parseSimBuildArgs([])).toThrow('--app <game-id> is required');
  });

  it('takes a debug query to open after launch, in test builds only', () => {
    const options = parseSimBuildArgs(['--app', 'line-siege', '--link', 'firstRun=0&screen=game']);
    expect(options.link).toStrictEqual({ query: 'firstRun=0&screen=game', waitFor: 'game.screen' });
    expect(linkScreenshotPath(options)).toBe('reports/ios/line-siege/smoke-test-test-link.png');
    expect(() =>
      parseSimBuildArgs(['--app', 'line-siege', '--variant', 'store', '--link', 'screen=home']),
    ).toThrow('--link needs a test build');
    expect(() =>
      parseSimBuildArgs(['--app', 'line-siege', '--link', 'e07://debug/setup?x=1']),
    ).toThrow('pass the debug query only');
    expect(() => parseSimBuildArgs(['--app', 'line-siege', '--link', 'firstRun=0'])).toThrow(
      'add --wait-for <testID>',
    );
  });

  it('waits for the root of the link screen, or for --wait-for', () => {
    expect([linkWaitFor('screen=how-to-play'), linkWaitFor('screen=result-win')]).toStrictEqual([
      'how-to-play.screen',
      'result.screen',
    ]);
    const args = ['--app', 'line-siege', '--link', 'firstRun=0', '--wait-for', 'home.screen'];
    expect(parseSimBuildArgs(args).link).toStrictEqual({
      query: 'firstRun=0',
      waitFor: 'home.screen',
    });
  });

  it('opens the link through Maestro and the setup sub-flow, which accept the iOS prompt', () => {
    const options = parseSimBuildArgs(['--app', 'line-siege', '--link', 'screen=home']);
    expect(linkProblems(options, () => false)).toStrictEqual([
      expect.stringContaining('tools/maestro/bin/maestro'),
      expect.stringContaining('packages/shell/e2e/subflows/debug-setup.yaml'),
    ]);
    expect(linkProblems(parseSimBuildArgs(['--app', 'line-siege']), () => false)).toStrictEqual([]);
    const link = { query: 'screen=home', waitFor: 'home.screen' };
    expect(
      linkSetupArgs({ udid: 'U', bundleId: 'com.x', scheme: 'e07-x', link, outDir: 'out' }),
    ).toStrictEqual([
      ...['test', 'packages/shell/e2e/subflows/debug-setup.yaml', '--udid', 'U'],
      ...['--test-output-dir', 'out', '-e', 'APP_ID=com.x', '-e', 'APP_SCHEME=e07-x'],
      ...['-e', 'QUERY=screen=home', '-e', 'WAIT_FOR=home.screen'],
    ]);
  });

  it('rejects an unknown flag', () => {
    expect(() => parseSimBuildArgs(['--app', 'line-siege', '--fast', 'yes'])).toThrow(
      'unexpected argument "--fast"',
    );
  });
});

describe('isHelpRequest', () => {
  it('answers --help and -h with the usage instead of an unexpected-argument error', () => {
    expect([isHelpRequest(['--help']), isHelpRequest(['-h'])]).toStrictEqual([true, true]);
    expect(isHelpRequest(['--app', 'line-siege'])).toBe(false);
    expect(SIM_BUILD_USAGE).toContain('--link <debug query>');
  });
});

describe('stale DerivedData (a copied or moved repo)', () => {
  const OLD = '/tmp/old-copy/repo/apps/line-siege/ios/LineSiege.xcworkspace';

  it('reads the repo root the DerivedData was built in', () => {
    expect(recordedRepoRoot(OLD, 'line-siege')).toBe('/tmp/old-copy/repo');
    expect(recordedRepoRoot('/Applications/Xcode.app', 'line-siege')).toBeNull();
  });

  it('is stale only when it names another root (/private/... and /... are one folder)', () => {
    const PRIVATE = ['', 'private'].join('/');
    expect(isStaleDerivedData(OLD, `${PRIVATE}/tmp/new-copy/repo`, 'line-siege')).toBe(true);
    expect(isStaleDerivedData(OLD, `${PRIVATE}/tmp/old-copy/repo`, 'line-siege')).toBe(false);
    expect(isStaleDerivedData(null, `${PRIVATE}/tmp/new-copy/repo`, 'line-siege')).toBe(false);
  });

  it('finds the module cache path inside a precompiled module', () => {
    const pcm = `\u0000\u0003[AM/tmp/old-copy/repo/apps/line-siege/build/dd/ModuleCache.noindex/K2H/SwiftShims-1.pcm\u0000`;
    expect(moduleCachePathIn(pcm, 'line-siege')).toBe(
      '/tmp/old-copy/repo/apps/line-siege/build/dd/ModuleCache.noindex/',
    );
    expect(moduleCachePathIn('no path here', 'line-siege')).toBeNull();
  });
});

describe('variantEnv', () => {
  it('exports the variant twice and the ads mode', () => {
    expect(variantEnv({ appVariant: 'store', adsMode: 'off' })).toStrictEqual({
      APP_VARIANT: 'store',
      EXPO_PUBLIC_APP_VARIANT: 'store',
      ADS_MODE: 'off',
    });
  });
});

describe('xcode paths', () => {
  it('derives the scheme from the workspace name', () => {
    expect(schemeOf('ios/LineSiege.xcworkspace')).toBe('LineSiege');
  });

  it('builds Release for the simulator without signing, arm64 only', () => {
    const args = xcodebuildSimArgs({
      workspace: 'ios/LineSiege.xcworkspace',
      scheme: 'LineSiege',
      udid: 'BBB',
    });
    expect(args).toStrictEqual(
      expect.arrayContaining(['Release', 'iphonesimulator', 'id=BBB', 'CODE_SIGNING_ALLOWED=NO']),
    );
    expect(args.at(-1)).toBe('build');
  });

  it('finds the built app and names the screenshot after the variant', () => {
    expect(builtAppPath('apps/line-siege', 'LineSiege')).toBe(
      'apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app',
    );
    const options = parseSimBuildArgs(['--app', 'line-siege', '--ads', 'off']);
    expect(screenshotPath(options)).toBe('reports/ios/line-siege/smoke-test-off.png');
  });
});

describe('readyReason', () => {
  it('is ready as soon as the perf log has a cold-start entry', () => {
    const probe = { attempt: 1, perfLog: '[{"kind":"cold-start"}]', screenUnchanged: false };
    expect(readyReason(probe)).toBe('perf-log');
  });

  it('gives Home longer when a perf log exists without the entry, then takes a still screen', () => {
    // A fresh install opens the first-run screens: Home never marks, the log stays '[]'.
    expect(readyReason({ attempt: 10, perfLog: '[]', screenUnchanged: true })).toBeNull();
    expect(readyReason({ attempt: 16, perfLog: '[]', screenUnchanged: false })).toBeNull();
    expect(readyReason({ attempt: 16, perfLog: '[]', screenUnchanged: true })).toBe(
      'stable-screen',
    );
  });

  it('falls back to a stable screen after 3 s when there is no perf log', () => {
    expect(readyReason({ attempt: 2, perfLog: null, screenUnchanged: true })).toBeNull();
    expect(readyReason({ attempt: 6, perfLog: null, screenUnchanged: true })).toBe('stable-screen');
  });
});
