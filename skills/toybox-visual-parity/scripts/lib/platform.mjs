// The two capture platforms. iOS is the default everywhere and keeps every path it always had; Android
// is added beside it: its own device profile (the e07-android-parity emulator), its own reference set
// (assets/reference-android/, rendered at that device's geometry) and its own run folders
// (.parity/android/), so an Android run can never be judged against, or mixed with, the iOS ones.
//
// A file that names no platform is iOS: run.json, report.json, a ledger entry, a waiver and a
// reference manifest written before Android existed all read as "ios".
import { join } from 'node:path';

import { fail } from '../check-lib.mjs';
import { ASSETS_DIR, DEFAULTS } from './paths.mjs';

export const PLATFORMS = ['ios', 'android'];
export const DEFAULT_PLATFORM = 'ios';

/** The defaults each platform reads when no option names a file. */
export const PLATFORM_DEFAULTS = Object.freeze({
  ios: Object.freeze({ device: DEFAULTS.device, reference: DEFAULTS.reference, runs: '.parity' }),
  android: Object.freeze({ device: join(ASSETS_DIR, 'device', 'android-phone.json'), reference: join(ASSETS_DIR, 'reference-android'), runs: join('.parity', 'android') }),
});

/** The --platform option every capture and sign-off script takes. */
export const PLATFORM_OPTION = Object.freeze({ type: 'string', value: 'ios|android', help: 'Capture platform: ios (the simulator, the default) or android (the emulator)', default: DEFAULT_PLATFORM });

/** The platform an option names, or exit 2. */
export function platformOption(value) {
  const platform = value ?? DEFAULT_PLATFORM;
  if (!PLATFORMS.includes(platform)) fail(`unknown platform "${platform}"`, 'Use --platform ios (the default) or --platform android.');
  return platform;
}

/** The platform a file records; a file that names none is iOS. */
export function platformOf(record) {
  return typeof record?.platform === 'string' && record.platform ? record.platform : DEFAULT_PLATFORM;
}

/** The device a profile drives: the simulator name on iOS, the AVD name on Android. */
export function deviceTargetName(device) {
  return device.avdName ?? device.simulatorName;
}

/** "simulator" or "emulator", for messages. */
export function deviceKind(platform) {
  return platform === 'android' ? 'emulator' : 'simulator';
}
