// Shared state of the fake adb, emulator and avdmanager. A case starts from the defaults (one ready
// e07-android-parity emulator on emulator-5554) overlaid with scenario.json of the fixture folder (the
// working directory); what a fake changes (an AVD created, an emulator started, night mode set) is kept
// in $FAKE_ANDROID_STATE_DIR/<the folder's hash>.json, so the next call sees it, as on a real device.
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULTS = {
  avds: ['e07-android-parity'],
  emulators: [{ serial: 'emulator-5554', avd: 'e07-android-parity', state: 'device' }],
  booted: true,
  wmSize: '1206x2622',
  wmSizeOverride: null,
  wmDensity: '480',
  wmDensityOverride: null,
  night: 'no',
  fontScale: '1.0',
  gestural: true,
  demoAllowed: '1',
  screenshots: [],
  launchFails: false,
};

const scenario = existsSync('scenario.json') ? JSON.parse(readFileSync('scenario.json', 'utf8')) : {};
const dir = process.env.FAKE_ANDROID_STATE_DIR;
const statePath = dir ? join(dir, `${createHash('sha1').update(process.cwd()).digest('hex').slice(0, 16)}.json`) : null;

export function loadState() {
  const saved = statePath && existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
  return { ...DEFAULTS, ...(scenario.android ?? {}), ...saved };
}

export function saveState(state) {
  if (!statePath) return;
  mkdirSync(dir, { recursive: true });
  const base = { ...DEFAULTS, ...(scenario.android ?? {}) };
  const changed = Object.fromEntries(Object.entries(state).filter(([k, v]) => JSON.stringify(base[k]) !== JSON.stringify(v)));
  writeFileSync(statePath, JSON.stringify(changed));
}

/** Every call of every fake, one line each, when $FAKE_ANDROID_LOG is set. */
export function logCall(tool, args) {
  if (process.env.FAKE_ANDROID_LOG) appendFileSync(process.env.FAKE_ANDROID_LOG, `${tool} ${args.join(' ')}\n`);
}

/** Print and exit. Written synchronously: on macOS a pipe write is asynchronous, and exiting right
 * after it would cut a screenshot short. */
export function done(text = '', code = 0) {
  const data = Buffer.isBuffer(text) ? text : Buffer.from(text, 'utf8');
  for (let at = 0; at < data.length; ) {
    try {
      at += writeSync(1, data, at, data.length - at);
    } catch (error) {
      if (error.code !== 'EAGAIN') throw error;
    }
  }
  process.exit(code);
}

export { scenario };
