// packages/shell/src/app/parity/read-parity-request.ts
// Test builds only (reached through test-only.ts). iOS puts launch arguments of the form
// `-parity "<query>"` into NSUserDefaults, where React Native's Settings module reads them. Android
// has no such arguments: the request arrives as the launch intent's string extra "parity"
// (`am start ... --es parity "<query>"`), read through the Shell's ParityLaunch module.
import { Platform, Settings } from 'react-native';

import { parityDateProblem } from './parity-fixture.ts';
import { androidLaunchExtras } from './parity-launch-extra.ts';
import { parseParityRequest } from './parity-request.ts';

import type { SettingsReader } from './parity-launch-extra.ts';
import type { ParityParseResult } from './parity-request.ts';

/** The launch argument capture-app.mjs passes (without its leading dash). */
export const PARITY_LAUNCH_ARGUMENT = 'parity';

const NOT_TEXT: ParityParseResult = { ok: false, error: 'the -parity launch argument is not text' };

/** Where this launch's values are: NSUserDefaults on iOS, the launch intent's extras on Android. */
function launchSettings(): SettingsReader {
  return Platform.OS === 'android' ? androidLaunchExtras() : Settings;
}

/**
 * The parity request of this launch: null when the app was launched without -parity (a normal
 * start), otherwise the parsed request or the reason it is invalid (show it; never fall back to
 * Home, which would be compared with the wrong reference).
 */
export function readParityRequest(
  settings: SettingsReader = launchSettings(),
): ParityParseResult | null {
  const raw = settings.get(PARITY_LAUNCH_ARGUMENT);
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return NOT_TEXT;
  const parsed = parseParityRequest(raw);
  if (!parsed.ok) return parsed;
  // Every date the frames draw (streak, week strip, "updated") hangs on the fixture's day.
  const dateProblem = parityDateProblem(parsed.request.date);
  return dateProblem === null ? parsed : { ok: false, error: dateProblem };
}
