#!/usr/bin/env node
// Fake avdmanager for the self-test: "list avd -c" prints the AVD names of the shared fake state;
// "create avd --name <n> --package <p> --device <d>" adds one and writes its config.ini under
// $ANDROID_AVD_HOME with the base device's own screen (a Pixel 8: 1080 x 2400 at 420), which the
// parity setup must then set to the profile's geometry.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { done, loadState, logCall, saveState } from './fake-android-state.mjs';

const args = process.argv.slice(2);
logCall('avdmanager', args);
const state = loadState();
if (args[0] === 'list' && args[1] === 'avd') done(state.avds.map((n) => `${n}\n`).join(''));
if (args[0] === 'create' && args[1] === 'avd') {
  const name = args[args.indexOf('--name') + 1];
  const pkg = args[args.indexOf('--package') + 1];
  if (state.avds.includes(name)) done(`Error: Android Virtual Device '${name}' already exists.\n`, 1);
  const home = process.env.ANDROID_AVD_HOME;
  if (!home) done('fake avdmanager: ANDROID_AVD_HOME is not set\n', 1);
  mkdirSync(join(home, `${name}.avd`), { recursive: true });
  const sysdir = `${pkg.split(';').join('/')}/`;
  writeFileSync(join(home, `${name}.avd`, 'config.ini'), `AvdId=${name}\nimage.sysdir.1=${sysdir}\nhw.lcd.width=1080\nhw.lcd.height=2400\nhw.lcd.density=420\nhw.device.name=pixel_8\n`);
  state.avds = [...state.avds, name];
  saveState(state);
  done('');
}
done(`fake avdmanager: unhandled ${args.join(' ')}\n`, 1);
