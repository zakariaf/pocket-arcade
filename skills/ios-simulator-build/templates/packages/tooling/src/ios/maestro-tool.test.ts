// packages/tooling/src/ios/maestro-tool.test.ts
import { debugSetupTestArgs, maestroEnvOf } from './maestro-tool.ts';

describe('maestroEnvOf', () => {
  it('turns off analytics, the analysis prompt and the update check, with Java 17', () => {
    expect(maestroEnvOf({ PATH: '/bin' }, () => '/jdk17')).toStrictEqual({
      PATH: '/bin',
      JAVA_HOME: '/jdk17',
      MAESTRO_CLI_NO_ANALYTICS: 'true',
      MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
      MAESTRO_DISABLE_UPDATE_CHECK: 'true',
    });
  });

  it("keeps the caller's own JAVA_HOME", () => {
    expect(maestroEnvOf({ JAVA_HOME: '/mine' }, () => '/jdk17')['JAVA_HOME']).toBe('/mine');
  });
});

describe('debugSetupTestArgs', () => {
  it('applies one debug link through the setup sub-flow, with no device of its own', () => {
    const args = debugSetupTestArgs({
      ...{ appId: 'io.applander.linesiege', scheme: 'e07-line-siege' },
      ...{ query: 'firstRun=0&screen=home', waitFor: 'home.screen', outDir: 'out' },
    });
    expect(args).toStrictEqual([
      ...['test', 'packages/shell/e2e/subflows/debug-setup.yaml', '--test-output-dir', 'out'],
      ...['-e', 'APP_ID=io.applander.linesiege', '-e', 'APP_SCHEME=e07-line-siege'],
      ...['-e', 'QUERY=firstRun=0&screen=home', '-e', 'WAIT_FOR=home.screen'],
    ]);
    expect(args).not.toContain('--device');
  });
});
