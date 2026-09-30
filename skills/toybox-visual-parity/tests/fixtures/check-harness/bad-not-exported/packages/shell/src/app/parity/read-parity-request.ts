// packages/shell/src/app/parity/read-parity-request.ts
// Test builds only (reached through test-only.ts). iOS puts launch arguments of the form
// `-parity "<query>"` into NSUserDefaults, where React Native's Settings module reads them.
import { Settings } from 'react-native';

import { parityDateProblem } from './parity-fixture.ts';
import { parseParityRequest } from './parity-request.ts';

import type { ParityParseResult } from './parity-request.ts';

/** The launch argument capture-app.mjs passes (without its leading dash). */
export const PARITY_LAUNCH_ARGUMENT = 'parity';

export type SettingsReader = { readonly get: (key: string) => unknown };

const NOT_TEXT: ParityParseResult = { ok: false, error: 'the -parity launch argument is not text' };

/**
 * The parity request of this launch: null when the app was launched without -parity (a normal
 * start), otherwise the parsed request or the reason it is invalid (show it; never fall back to
 * Home, which would be compared with the wrong reference).
 */
export function readParityRequest(settings: SettingsReader = Settings): ParityParseResult | null {
  const raw = settings.get(PARITY_LAUNCH_ARGUMENT);
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return NOT_TEXT;
  const parsed = parseParityRequest(raw);
  if (!parsed.ok) return parsed;
  // Every date the frames draw (streak, week strip, "updated") hangs on the fixture's day.
  const dateProblem = parityDateProblem(parsed.request.date);
  return dateProblem === null ? parsed : { ok: false, error: dateProblem };
}
