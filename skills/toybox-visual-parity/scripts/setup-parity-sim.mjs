#!/usr/bin/env node
// setup-parity-sim.mjs: creates (once), boots and pins the dedicated parity simulator.
import { resolve } from 'node:path';

import { createReporter, fail, parseArgs, run } from './check-lib.mjs';
import { DEFAULTS, readJson } from './lib/paths.mjs';
import { findSimulator, makeSimctl } from './lib/tools.mjs';

const SPEC = {
  name: 'setup-parity-sim',
  summary:
    'Creates (if needed) and boots the dedicated "e07-parity" simulator (iPhone 16 Pro on iOS 26.5), sets the system ' +
    'locale to en_US (so the clock reads 9:41, not 09:41), overrides the status bar (9:41, full Wi-Fi and cellular, ' +
    '100 % battery, no operator), and sets the appearance, text size (large) and Increase Contrast (off). ' +
    '--check changes nothing and fails when any of that is not true.',
  usage: '--appearance light|dark [--check] [options]',
  options: {
    appearance: { type: 'string', value: 'light|dark', help: 'System appearance to set (match the theme you capture)' },
    check: { type: 'boolean', help: 'Change nothing; exit 1 when the simulator is not ready for parity captures' },
    recreate: { type: 'boolean', help: 'Delete and recreate a same-named simulator that has the wrong model or iOS version' },
    name: { type: 'string', value: 'name', help: 'Simulator name (default: the device profile\'s simulatorName, e07-parity)' },
    device: { type: 'string', value: 'file', help: 'Device profile', default: DEFAULTS.device },
    xcrun: { type: 'string', value: 'path', help: 'xcrun to use (default: xcrun on PATH, or $PARITY_XCRUN)' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'It never touches another simulator. Status bar overrides are cleared by every reboot, so run it again',
    'after a reboot (capture-app.mjs re-applies a missing override too). Prints "udid <UDID>".',
    '',
    'Examples:',
    '  node setup-parity-sim.mjs --appearance light',
    '  node setup-parity-sim.mjs --appearance dark --check',
  ].join('\n'),
};

const STATUS_ARGS = (o) => [
  '--time', o.time, '--dataNetwork', o.dataNetwork, '--wifiMode', o.wifiMode, '--wifiBars', o.wifiBars,
  '--cellularMode', o.cellularMode, '--cellularBars', o.cellularBars, '--operatorName', o.operatorName,
  '--batteryState', o.batteryState, '--batteryLevel', o.batteryLevel,
];

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  if (!options.appearance) fail('nothing to do: pass --appearance light or --appearance dark', 'Run: node setup-parity-sim.mjs --help');
  if (!['light', 'dark'].includes(options.appearance)) fail(`unknown appearance "${options.appearance}"`, 'Use light or dark.');
  const device = readJson(resolve(options.device), 'device profile');
  const name = options.name ?? device.simulatorName;
  const simctl = makeSimctl(options.xcrun);
  const report = createReporter({ name: 'setup-parity-sim' });
  const problem = (rule, message, fix) => report.problem({ file: name, rule, message, fix });
  const step = (text) => report.note(`${options.check ? 'check' : 'setup'} ${text}`);
  const must = (r, what) => {
    if (r.status !== 0) fail(`${what} failed: ${(r.stderr || r.stdout).trim().split('\n')[0]}`, 'Read the simctl message; if this session\'s simulator is wedged, shut down only it (xcrun simctl shutdown <its UDID>) and run this script again; other sessions\' simulators are never touched.');
    return r.stdout;
  };

  // Runtime and model exist on this Mac.
  const runtimes = simctl.json('list', 'runtimes', '-j').runtimes ?? [];
  const rt = runtimes.find((r) => r.identifier === device.runtime);
  if (!rt || rt.isAvailable === false) {
    fail(`the iOS ${device.runtimeVersion} simulator runtime is not installed`, `Human step: install it (Xcode > Settings > Components, or: xcodebuild -downloadPlatform iOS -buildVersion ${device.runtimeVersion}).`);
  }
  const types = simctl.json('list', 'devicetypes', '-j').devicetypes ?? [];
  if (!types.some((t) => t.identifier === device.deviceType)) fail(`the device type ${device.deviceType} is not available`, 'Update Xcode (26.6 ships the iPhone 16 Pro profile).');

  // The dedicated simulator: right model, right runtime, exactly one.
  let found = findSimulator(simctl, name);
  const wrong = found.filter((f) => f.runtime !== device.runtime || (f.device.deviceTypeIdentifier && f.device.deviceTypeIdentifier !== device.deviceType));
  if (wrong.length) {
    if (options.recreate && !options.check) {
      for (const w of wrong) {
        step(`deleting ${name} (${w.device.udid}) on ${w.runtime}`);
        simctl('shutdown', w.device.udid);
        must(simctl('delete', w.device.udid), `xcrun simctl delete ${w.device.udid}`);
      }
      found = findSimulator(simctl, name);
    } else {
      for (const w of wrong) problem('sim-wrong-model', `a simulator named ${name} (${w.device.udid}) is ${w.device.deviceTypeIdentifier ?? 'another model'} on ${w.runtime}`, `Run with --recreate, or delete it: xcrun simctl delete ${w.device.udid}`);
    }
  }
  let sim = found.find((f) => f.runtime === device.runtime && (!f.device.deviceTypeIdentifier || f.device.deviceTypeIdentifier === device.deviceType));
  if (found.filter((f) => f.runtime === device.runtime).length > 1) problem('sim-duplicate', `${found.length} simulators are named ${name}`, 'Delete the extra ones (xcrun simctl delete <udid>) so every script talks to the same device.');
  // Never add a second device with the same name next to a wrong or duplicate one.
  if (report.count > 0 && !options.check) return report.finish({ checked: 1, unit: 'simulators' });
  if (!sim) {
    if (options.check) {
      problem('sim-missing', `no ${name} simulator (${device.name}, iOS ${device.runtimeVersion})`, 'Run: node setup-parity-sim.mjs --appearance light');
      return report.finish({ checked: 1, unit: 'simulators' });
    }
    const udid = must(simctl('create', name, device.deviceType, device.runtime), `xcrun simctl create ${name}`).trim();
    step(`created ${name} ${udid}`);
    sim = findSimulator(simctl, name).find((f) => f.device.udid === udid);
    if (!sim) fail(`created ${udid} but cannot find it again`, 'Run the script again.');
  }
  const udid = sim.device.udid;
  const boot = () => {
    must(simctl('boot', udid), `xcrun simctl boot ${udid}`);
    must(simctl('bootstatus', udid, '-b'), `xcrun simctl bootstatus ${udid}`);
  };
  if (sim.device.state !== 'Booted') {
    if (options.check) problem('sim-not-booted', `${name} is ${sim.device.state}`, 'Run: node setup-parity-sim.mjs --appearance <theme>');
    else {
      step(`booting ${udid}`);
      boot();
    }
  }
  if (report.count > 0) return report.finish({ checked: 1, unit: 'simulators' });

  // System locale en_US: with the host's region the status-bar clock reads "09:41".
  const locale = simctl('spawn', udid, 'defaults', 'read', '-g', 'AppleLocale').stdout.trim();
  if (locale !== device.systemLocale) {
    if (options.check) problem('sim-locale', `AppleLocale is "${locale || 'unset'}", not ${device.systemLocale} (the status bar would show 24-hour time)`, 'Run setup-parity-sim.mjs without --check (it sets the locale and reboots once).');
    else {
      step(`setting AppleLocale ${device.systemLocale} (was "${locale}") and rebooting`);
      must(simctl('spawn', udid, 'defaults', 'write', '-g', 'AppleLocale', '-string', device.systemLocale), 'defaults write AppleLocale');
      must(simctl('spawn', udid, 'defaults', 'write', '-g', 'AppleLanguages', '-array', 'en'), 'defaults write AppleLanguages');
      must(simctl('spawn', udid, 'defaults', 'write', '-g', 'AppleICUForce12HourTime', '-bool', 'true'), 'defaults write AppleICUForce12HourTime');
      must(simctl('shutdown', udid), `xcrun simctl shutdown ${udid}`);
      boot();
    }
  }

  // Status bar override (cleared by every reboot).
  const bar = simctl('status_bar', udid, 'list').stdout;
  const barOk = bar.includes(device.statusBarOverride.time) && /battery/i.test(bar);
  if (!barOk) {
    if (options.check) problem('sim-status-bar', 'the status bar is not overridden (real clock, carrier and battery would show)', 'Run setup-parity-sim.mjs without --check.');
    else {
      step(`overriding the status bar (${device.statusBarOverride.time}, full bars, 100 % battery)`);
      must(simctl('status_bar', udid, 'override', ...STATUS_ARGS(device.statusBarOverride)), 'xcrun simctl status_bar override');
    }
  }

  // Appearance, text size, contrast.
  const settings = [
    ['appearance', options.appearance],
    ['content_size', device.contentSize],
    ['increase_contrast', 'disabled'],
  ];
  for (const [key, want] of settings) {
    const now = simctl('ui', udid, key).stdout.trim();
    if (now === want) continue;
    if (options.check) problem(`sim-${key.replace('_', '-')}`, `${key} is "${now}", not "${want}"`, `Run setup-parity-sim.mjs --appearance ${options.appearance}.`);
    else {
      step(`${key} ${want} (was "${now}")`);
      must(simctl('ui', udid, key, want), `xcrun simctl ui ${key} ${want}`);
    }
  }
  report.note(`udid ${udid}`);
  return report.finish({ checked: 1, unit: 'simulators' });
});
