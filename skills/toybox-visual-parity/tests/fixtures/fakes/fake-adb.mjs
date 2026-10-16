#!/usr/bin/env node
// Fake adb for the self-test. Like the real one with several emulators running, it refuses any call
// that does not name its device first (-s <serial>), except "adb devices". It answers from the shared
// fake state (fake-android-state.mjs): emulators, boot, display size and density, night mode, font
// scale, gesture navigation, demo mode, screenshots (scenario.android.screenshots, served in order, the
// last one repeating) and launches: "am start ... --es parity <query>" writes the query's nonce to
// $FAKE_PARITY_STATE, where the fake maestro reads it, as the app's parity root renders the marker.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { done, loadState, logCall, saveState } from './fake-android-state.mjs';

const args = process.argv.slice(2);
logCall('adb', args);
const state = loadState();

if (args[0] !== '-s') {
  if (args[0] === 'devices') {
    const lines = state.emulators.map((e) => `${e.serial}\t${e.state}`);
    done(`List of devices attached\n${lines.map((l) => `${l}\n`).join('')}\n`);
  }
  done('error: more than one device/emulator\n', 1);
}
const serial = args[1];
const emulator = state.emulators.find((e) => e.serial === serial);
if (!emulator) done(`error: device '${serial}' not found\n`, 1);
const rest = args.slice(2);

/** The words of one shell command line (single quotes as shellQuote writes them). */
function words(line) {
  const out = [];
  let current = '';
  let quoted = false;
  let has = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === "'") quoted = false;
      else current += ch;
    } else if (ch === "'") {
      quoted = true;
      has = true;
    } else if (ch === '\\' && i + 1 < line.length) {
      current += line[i + 1];
      i += 1;
      has = true;
    } else if (/\s/.test(ch)) {
      if (has || current) out.push(current);
      current = '';
      has = false;
    } else {
      current += ch;
      has = true;
    }
  }
  if (has || current) out.push(current);
  return out;
}

if (rest[0] === 'emu' && rest[1] === 'avd' && rest[2] === 'name') done(`${emulator.avd}\nOK\n`);
if (rest[0] === 'exec-out' && rest[1] === 'screencap') {
  const n = state.screenCount ?? 0;
  state.screenCount = n + 1;
  saveState(state);
  const list = state.screenshots;
  if (!list.length) done('', 1);
  done(readFileSync(resolve(list[Math.min(n, list.length - 1)])));
}
if (rest[0] !== 'shell' || rest.length !== 2) done(`fake adb: unhandled ${args.join(' ')}\n`, 1);
const w = words(rest[1]);
const line = w.join(' ');
const set = (patch) => {
  Object.assign(state, patch);
  saveState(state);
};
/** A command that changes the device: keep the change, then print what adb prints. */
const setThen = (patch, text) => {
  set(patch);
  done(text);
};
if (line === 'getprop sys.boot_completed') done(state.booted ? '1\n' : '\n');
if (line === 'wm size') done(`Physical size: ${state.wmSize}\n${state.wmSizeOverride ? `Override size: ${state.wmSizeOverride}\n` : ''}`);
if (line === 'wm size reset') setThen({ wmSizeOverride: null }, '');
if (line === 'wm density') done(`Physical density: ${state.wmDensity}\n${state.wmDensityOverride ? `Override density: ${state.wmDensityOverride}\n` : ''}`);
if (line === 'wm density reset') setThen({ wmDensityOverride: null }, '');
if (line === 'cmd uimode night') done(`Night mode: ${state.night}\n`);
if (w[0] === 'cmd' && w[1] === 'uimode' && w[2] === 'night' && w.length === 4) setThen({ night: w[3] }, `Night mode: ${w[3]}\n`);
if (line === 'settings get system font_scale') done(`${state.fontScale}\n`);
if (w[0] === 'settings' && w[1] === 'put' && w[3] === 'font_scale') setThen({ fontScale: w[4] }, '');
if (line === 'settings get global sysui_demo_allowed') done(`${state.demoAllowed}\n`);
if (w[0] === 'settings' && w[1] === 'put' && w[3] === 'sysui_demo_allowed') setThen({ demoAllowed: w[4] }, '');
if (w[0] === 'am' && w[1] === 'broadcast') {
  if (w.includes('enter')) set({ demoEntered: true });
  done('Broadcasting: Intent { act=com.android.systemui.demo flg=0x400000 (has extras) }\nBroadcast completed: result=0\n');
}
if (line === 'cmd overlay list') done(`com.android.internal.systemui.navbar.gestural\n[${state.gestural ? 'x' : ' '}] com.android.internal.systemui.navbar.gestural\n[${state.gestural ? ' ' : 'x'}] com.android.internal.systemui.navbar.threebutton\n`);
if (w[0] === 'cmd' && w[1] === 'overlay' && w[2] === 'enable-exclusive') setThen({ gestural: true }, '');
if (w[0] === 'cmd' && w[1] === 'locale' && w[2] === 'set-app-locales') setThen({ appLocale: w[w.indexOf('--locales') + 1] }, '');
if (w[0] === 'am' && w[1] === 'start') {
  const query = w[w.indexOf('--es') + 2] ?? '';
  const nonce = new URLSearchParams(query).get('nonce');
  if (process.env.FAKE_PARITY_STATE && nonce) writeFileSync(process.env.FAKE_PARITY_STATE, JSON.stringify({ nonce, serial }));
  if (state.launchFails) done('Starting: Intent { cmp=io.applander.linesiege/.MainActivity (has extras) }\nError: Activity class {io.applander.linesiege/io.applander.linesiege.MainActivity} does not exist.\n');
  done('Starting: Intent { cmp=io.applander.linesiege/.MainActivity (has extras) }\nStatus: ok\nLaunchState: COLD\nActivity: io.applander.linesiege/.MainActivity\nTotalTime: 812\nWaitTime: 815\nComplete\n');
}
done(`fake adb: unhandled shell ${line}\n`, 1);
