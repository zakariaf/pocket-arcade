// android-e2e.mjs: when the Android end-to-end set is due, shared by check-e2e-setup and check-flows
// (a helper, not an entry point).
//
// The Android E2E tooling lands at Android step 7 (E2E and the screenshot matrix). Before that step
// a repo has none of its files, and the Android rules print one not-yet-due SKIP line each. Once any
// of them exists (a file, its test, the airplane sub-flow or one of the two npm scripts), the step
// has started and the whole set is checked strictly: a half-copied runner never passes.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ANDROID_E2E_DIR = 'packages/tooling/src/e2e';
export const ANDROID_RUNNER = `${ANDROID_E2E_DIR}/run-e2e-android.ts`;
export const ANDROID_CAPTURE = `${ANDROID_E2E_DIR}/capture-screenshots-android.ts`;
export const AIRPLANE_SUBFLOW = 'packages/shell/e2e/subflows/airplane-mode.yaml';

/** Every file of the Android E2E set (tests excluded), the runner first. */
export const ANDROID_E2E_FILES = Object.freeze([
  ANDROID_RUNNER,
  ANDROID_CAPTURE,
  `${ANDROID_E2E_DIR}/android-cli.ts`,
  `${ANDROID_E2E_DIR}/android-device-args.ts`,
  `${ANDROID_E2E_DIR}/android-e2e-device.ts`,
  `${ANDROID_E2E_DIR}/android-flow-steps.ts`,
  `${ANDROID_E2E_DIR}/android-socket-sampler.ts`,
  `${ANDROID_E2E_DIR}/android-cold-start.ts`,
  `${ANDROID_E2E_DIR}/android-memory.ts`,
  `${ANDROID_E2E_DIR}/emu-perf-steps.ts`,
  `${ANDROID_E2E_DIR}/sample-sockets-android.ts`,
  AIRPLANE_SUBFLOW,
]);

export const ANDROID_SCRIPTS = Object.freeze({
  'e2e:android': `node ${ANDROID_RUNNER}`,
  'screenshots:android': `node ${ANDROID_CAPTURE}`,
});

const isAndroidE2eName = (name) => /android/.test(name) || /^emu-perf-steps\./.test(name);

function scriptsOf(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts ?? {};
  } catch {
    return {};
  }
}

/**
 * null when Android step 7 has started (any file of the set, a test of one, or an Android npm
 * script exists), else the not-yet-due reason for a SKIP line, naming `rel` (default the runner).
 */
export function androidE2eSkipReason(root, rel = ANDROID_RUNNER) {
  const dir = join(root, ANDROID_E2E_DIR);
  const hasTooling = existsSync(dir) && readdirSync(dir).some(isAndroidE2eName);
  const scripts = scriptsOf(root);
  const hasScript = Object.keys(ANDROID_SCRIPTS).some((name) => scripts[name] !== undefined);
  if (hasTooling || hasScript || existsSync(join(root, AIRPLANE_SUBFLOW))) return null;
  return `due at Android step 7: ${rel} not yet created`;
}
