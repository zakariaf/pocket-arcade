#!/usr/bin/env node
// Fake "xcrun simctl" for the self-test. Answers from scenario.json in the working directory (the
// fixture folder); anything the scenario does not set has the value of a ready parity simulator.
import { appendFileSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const scenario = existsSync('scenario.json') ? JSON.parse(readFileSync('scenario.json', 'utf8')) : {};
const UDID = '11111111-2222-3333-4444-555555555555';
const s = {
  runtimes: [{ identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-26-5', version: '26.5', isAvailable: true }],
  devicetypes: [{ identifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro', name: 'iPhone 16 Pro' }],
  devices: { 'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [{ name: 'e07-parity', udid: UDID, state: 'Booted', deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro' }] },
  locale: 'en_US',
  statusBar: 'Current Status Bar Overrides:\n=============================\nTime: 9:41 \nDataNetworkType: 11\nWiFi Mode: 3, WiFi Bars: 3\nCell Mode: 3, Cell Bars: 4\nOperator Name: \nBattery State: 0, Battery Level: 100, Not Charging: 0\n',
  ui: { appearance: 'light', content_size: 'large', increase_contrast: 'disabled' },
  launchctl: '93512\t0\tUIKitApplication:com.example.linesiege.test[ee0e][rb-legacy]\n93511\t0\tUIKitApplication:com.apple.Spotlight[b96c][rb-legacy]\n',
  screenshots: [],
  ...scenario,
};
const args = process.argv.slice(2);
const log = process.env.FAKE_XCRUN_LOG;
if (log) appendFileSync(log, args.join(' ') + '\n');
const done = (text = '', code = 0) => {
  process.stdout.write(text);
  process.exit(code);
};
if (args[0] !== 'simctl') done('', 64);
const [cmd, ...rest] = args.slice(1);
if (cmd === 'list') {
  const what = rest[0];
  if (what === 'runtimes') done(JSON.stringify({ runtimes: s.runtimes }));
  if (what === 'devicetypes') done(JSON.stringify({ devicetypes: s.devicetypes }));
  done(JSON.stringify({ devices: s.devices }));
}
if (cmd === 'create') done(UDID + '\n');
if (['boot', 'bootstatus', 'shutdown', 'delete', 'terminate'].includes(cmd)) done('');
if (cmd === 'spawn') {
  const tool = rest.slice(1).join(' ');
  if (tool.startsWith('defaults read -g AppleLocale')) done(s.locale + '\n');
  if (tool.startsWith('defaults write')) done('');
  if (tool.startsWith('launchctl list')) done(s.launchctl);
  done('', 1);
}
if (cmd === 'status_bar') done(rest[1] === 'list' ? s.statusBar : '');
if (cmd === 'ui') done(rest.length === 2 ? (s.ui[rest[1]] ?? '') + '\n' : '');
if (cmd === 'launch') done(s.launchFails ? '' : 'com.example.linesiege.test: 93512\n', s.launchFails ? 1 : 0);
if (cmd === 'io' && rest[1] === 'screenshot') {
  // Screenshots are served in order from scenario.screenshots (paths relative to the fixture folder);
  // the last one repeats. The counter lives next to the output file.
  const target = rest[rest.length - 1];
  const counter = join(dirname(resolve(target)), '.fake-screenshot-count');
  const n = existsSync(counter) ? Number(readFileSync(counter, 'utf8')) : 0;
  writeFileSync(counter, String(n + 1));
  const list = s.screenshots;
  copyFileSync(resolve(list[Math.min(n, list.length - 1)]), target);
  done('Wrote screenshot to: ' + target + '\n');
}
done('fake xcrun: unhandled ' + args.join(' ') + '\n', 1);
