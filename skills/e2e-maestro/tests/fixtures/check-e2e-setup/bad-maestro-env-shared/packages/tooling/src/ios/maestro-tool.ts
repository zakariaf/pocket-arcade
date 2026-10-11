// packages/tooling/src/ios/maestro-tool.ts
// The one way repo tooling starts Maestro outside its target flags (maestro-args.ts): the pinned
// binary, Java 17 with no analytics, analysis prompt or update check, and the debug-setup sub-flow
// that applies one debug link to the running app (it accepts iOS's "Open in <app>?" prompt, which
// `simctl openurl` alone leaves up). build:ios:sim --link and e2e-maestro's runners use it.
import { spawnSync } from 'node:child_process';

/** Installed by packages/tooling/scripts/install-maestro.sh (e2e-maestro), pinned and checked. */
export const MAESTRO_BIN = 'tools/maestro/bin/maestro';
/** e2e-maestro's setup sub-flow: waits for a screen root, applies QUERY, waits for WAIT_FOR. */
export const DEBUG_SETUP_FLOW = 'packages/shell/e2e/subflows/debug-setup.yaml';
const ANDROID_STUDIO_JAVA = '/Applications/Android Studio.app/Contents/jbr/Contents/Home';

/** Java 17: /usr/libexec/java_home -v 17, else Android Studio's bundled JBR. */
export function javaHome(): string {
  const found = spawnSync('/usr/libexec/java_home', ['-v', '17'], { encoding: 'utf8' });
  return found.status === 0 ? found.stdout.trim() : ANDROID_STUDIO_JAVA;
}

/** Maestro's environment: Java 17 and no analytics, update check or analysis prompt. */
export function maestroEnvOf(
  env: NodeJS.ProcessEnv,
  findJava: () => string = javaHome,
): NodeJS.ProcessEnv {
  return {
    ...env,
    JAVA_HOME: env['JAVA_HOME'] ?? findJava(),
    MAESTRO_CLI_NO_ANALYTICS: 'true',
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
  };
}

export type DebugSetup = {
  readonly appId: string;
  readonly scheme: string;
  /** The debug link's query, for example 'lang=en&firstRun=0&screen=home'. */
  readonly query: string;
  /** The testID that proves the link's screen is shown. */
  readonly waitFor: string;
  readonly outDir: string;
};

/**
 * `maestro test` arguments that apply one debug link through the setup sub-flow. The caller puts
 * maestroGlobalArgs (the device and this run's driver port) before them.
 */
export function debugSetupTestArgs(run: DebugSetup): string[] {
  return [
    ...['test', DEBUG_SETUP_FLOW, '--test-output-dir', run.outDir],
    ...['-e', `APP_ID=${run.appId}`, '-e', `APP_SCHEME=${run.scheme}`],
    ...['-e', `QUERY=${run.query}`, '-e', `WAIT_FOR=${run.waitFor}`],
  ];
}
