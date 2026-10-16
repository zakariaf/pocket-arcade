#!/usr/bin/env node
// setup-parity-emu.mjs: creates (once), boots and pins this session's Android parity emulator, the
// counterpart of setup-parity-sim.mjs. It touches only an AVD named e07-android-parity[-<key>], names
// every adb call's device (-s <serial>), and never downloads anything: the system image is installed
// by android-emulator-build's step (an owner-approved sdkmanager run), never here.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { createReporter, fail, parseArgs, run } from './check-lib.mjs';
import { PARITY_AVD, avdHomeOf, demoModeCommands, freeConsolePort, makeAdb, makeAvdmanager, makeEmulator, readAvdConfig, runningEmulators, sdkRootOf, systemImageDir } from './lib/android.mjs';
import { readJson } from './lib/paths.mjs';
import { PLATFORM_DEFAULTS } from './lib/platform.mjs';
import { sleep } from './lib/tools.mjs';

const SPEC = {
  name: 'setup-parity-emu',
  summary:
    'Creates (if needed) the Android parity AVD "e07-android-parity" (the android-emulator-build system image, ' +
    '402 x 874 dp at density 3.0 = 1206 x 2622 px, like the iPhone 16 Pro), boots it on a free console port, and pins ' +
    'it: no display size or density override, night mode for the appearance, font scale 1.0, gesture navigation, demo ' +
    'mode allowed and on (09:41, full battery and Wi-Fi, no notifications). Prints "serial <serial>". --check changes ' +
    'nothing and fails when any of that is not true.',
  usage: '--appearance light|dark [--check] [options]',
  options: {
    appearance: { type: 'string', value: 'light|dark', help: 'Night mode to set (match the theme you capture)' },
    check: { type: 'boolean', help: 'Change nothing; exit 1 when the emulator is not ready for parity captures' },
    name: { type: 'string', value: 'name', help: "AVD name, e07-android-parity[-<key>] (default: the device profile's avdName)" },
    device: { type: 'string', value: 'file', help: 'Device profile', default: PLATFORM_DEFAULTS.android.device },
    sdk: { type: 'string', value: 'dir', help: 'Android SDK (default: $ANDROID_HOME, $ANDROID_SDK_ROOT, ~/Library/Android/sdk)' },
    'avd-home': { type: 'string', value: 'dir', help: 'AVD folder (default: $ANDROID_AVD_HOME, ~/.android/avd)' },
    adb: { type: 'string', value: 'path', help: 'adb to use (default: $PARITY_ADB, <sdk>/platform-tools/adb)' },
    emulator: { type: 'string', value: 'path', help: 'emulator to use (default: $PARITY_EMULATOR, <sdk>/emulator/emulator)' },
    avdmanager: { type: 'string', value: 'path', help: 'avdmanager to use (default: $PARITY_AVDMANAGER, <sdk>/cmdline-tools/latest/bin/avdmanager)' },
    'boot-timeout': { type: 'string', value: 's', help: 'Longest wait for a cold boot, in seconds', default: '240' },
    'log-dir': { type: 'string', value: 'dir', help: "Where the emulator's output goes", default: join('.parity', 'logs') },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'It never touches another AVD or emulator (other projects keep theirs on this Mac) and never restarts the adb',
    'server. The geometry lives in the AVD\'s config.ini (hw.lcd.width, hw.lcd.height, hw.lcd.density): it is set',
    'when the AVD is made and while it is shut down; a running emulator with the wrong geometry is reported, never',
    'killed. Demo mode is lost when SystemUI restarts, so capture-app.mjs --platform android sends it before every',
    'capture too. The emulator keeps running after this script; shut it down at the end of the session with',
    '"adb -s <serial> emu kill" (your own serial only).',
    '',
    'Examples:',
    '  node setup-parity-emu.mjs --appearance light --name e07-android-parity-b',
    '  node setup-parity-emu.mjs --appearance dark --check --name e07-android-parity-b',
  ].join('\n'),
};

const NIGHT = { light: 'no', dark: 'yes' };

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  if (!options.appearance) fail('nothing to do: pass --appearance light or --appearance dark', 'Run: node setup-parity-emu.mjs --help');
  if (!NIGHT[options.appearance]) fail(`unknown appearance "${options.appearance}"`, 'Use light or dark.');
  const device = readJson(resolve(options.device), 'device profile');
  if (device.platform !== 'android') fail(`${options.device} is not an Android device profile`, 'Use assets/device/android-phone.json (the default).');
  const name = options.name ?? device.avdName;
  if (!PARITY_AVD.test(name)) fail(`refuses the AVD "${name}": the parity scripts create, start and pin only e07-android-parity[-<key>]`, 'Pass --name e07-android-parity-<key> (lowercase letters and digits); other AVDs belong to other sessions or projects.');
  const bootTimeoutMs = Number(options['boot-timeout']) * 1000;
  if (!(bootTimeoutMs > 0)) fail(`--boot-timeout must be seconds above 0, got "${options['boot-timeout']}"`, 'Pass e.g. --boot-timeout 240.');
  const sdk = resolve(sdkRootOf(options.sdk));
  const avdHome = resolve(avdHomeOf(options['avd-home']));
  // Child tools (avdmanager, the emulator) read the same AVD folder.
  process.env.ANDROID_AVD_HOME = avdHome;
  const image = systemImageDir(sdk, device.systemImage);
  if (!existsSync(image)) fail(`the system image ${device.systemImage} is not installed in ${sdk}`, 'This script never downloads: android-emulator-build installs the pinned image (an owner-approved sdkmanager run, E18-T12). Set ANDROID_HOME if the SDK lives elsewhere.');
  const adb = makeAdb({ adb: options.adb, sdk });
  const avdmanager = makeAvdmanager({ avdmanager: options.avdmanager, sdk });
  const emulator = makeEmulator({ emulator: options.emulator, sdk });
  const report = createReporter({ name: 'setup-parity-emu' });
  const problem = (rule, message, fix) => report.problem({ file: name, rule, message, fix });
  const step = (text) => report.note(`${options.check ? 'check' : 'setup'} ${text}`);
  const finish = () => report.finish({ checked: 1, unit: 'emulators' });
  const wantSysdir = `${device.systemImage.split(';').join('/')}/`;

  // 1. The AVD exists, on the pinned image, with the parity geometry.
  let running = runningEmulators(adb).filter((e) => e.avd === name);
  const exists = avdmanager.names().includes(name);
  if (!exists) {
    if (options.check) {
      problem('emu-missing', `no ${name} AVD (${device.name}, ${device.systemImage})`, 'Run: node setup-parity-emu.mjs --appearance light' + (name === device.avdName ? '' : ` --name ${name}`));
      return finish();
    }
    const created = avdmanager.create(name, device.systemImage, device.baseDevice);
    if (created.status !== 0) fail(`avdmanager create avd --name ${name} failed: ${(created.stderr || created.stdout).trim().split('\n')[0]}`, 'Read the message; the system image must be installed and the SDK licences accepted (the owner\'s step).');
    step(`created ${name} (${device.systemImage}, base ${device.baseDevice})`);
  }
  const avd = readAvdConfig(avdHome, name);
  if (!avd) {
    problem('emu-missing', `${name} has no config.ini in ${avdHome}`, `Delete your own broken AVD (avdmanager delete avd --name ${name}) and run this script again.`);
    return finish();
  }
  const sysdir = avd.config['image.sysdir.1'];
  if (sysdir !== wantSysdir) problem('emu-wrong-image', `${name} runs ${sysdir ?? 'no image'}, not ${wantSysdir}`, `Delete your own AVD (avdmanager delete avd --name ${name}) and run this script again: an AVD keeps the image it was made with.`);
  const wrongHardware = Object.entries(device.hardware).filter(([key, want]) => avd.config[key] !== want);
  if (wrongHardware.length) {
    if (options.check || running.length) {
      for (const [key, want] of wrongHardware) problem('emu-wrong-geometry', `${key} is ${avd.config[key] ?? 'unset'}, not ${want}${running.length ? ` (${name} is running, so its config.ini is not changed)` : ''}`, running.length ? `Shut down your own emulator (adb -s ${running[0].serial} emu kill), then run setup-parity-emu.mjs without --check.` : 'Run setup-parity-emu.mjs without --check (it sets the geometry while the AVD is shut down).');
    } else {
      const lines = readAvdLines(avd.path).filter((line) => !wrongHardware.some(([key]) => line.startsWith(`${key}=`)));
      writeFileSync(avd.path, `${[...lines, ...wrongHardware.map(([key, want]) => `${key}=${want}`)].join('\n')}\n`);
      step(`config.ini ${wrongHardware.map(([key, want]) => `${key}=${want}`).join(' ')}`);
    }
  }
  if (report.count > 0) return finish();

  // 2. Exactly one emulator runs it, booted.
  if (running.length > 1) {
    problem('emu-duplicate', `${name} runs on ${running.length} serials (${running.map((e) => e.serial).join(', ')})`, `Shut down the extra one of your own (adb -s <serial> emu kill) so every script talks to the same device.`);
    return finish();
  }
  if (running.length === 0) {
    if (options.check) {
      problem('emu-not-booted', `${name} is not running`, `Run: node setup-parity-emu.mjs --appearance ${options.appearance}${name === device.avdName ? '' : ` --name ${name}`}`);
      return finish();
    }
    const port = freeConsolePort(runningEmulators(adb));
    const logPath = join(resolve(options['log-dir']), `${name}.log`);
    mkdirSync(resolve(options['log-dir']), { recursive: true });
    emulator.start(name, port, logPath);
    step(`starting ${name} on emulator-${port} (cold boot, no window; log ${join(options['log-dir'], `${name}.log`)})`);
    const began = Date.now();
    while (Date.now() - began < bootTimeoutMs) {
      running = runningEmulators(adb).filter((e) => e.avd === name && e.state === 'device');
      if (running.length && adb.on(running[0].serial).shell('getprop', 'sys.boot_completed').stdout.trim() === '1') break;
      await sleep(1000);
    }
    if (!running.length) fail(`${name} did not come up within ${options['boot-timeout']} s`, `Read ${logPath}; a cold first boot takes 1-2 minutes on this Mac.`);
  }
  const serial = running[0].serial;
  const sh = adb.on(serial).shell;
  if (sh('getprop', 'sys.boot_completed').stdout.trim() !== '1') {
    if (options.check) {
      problem('emu-not-booted', `${name} (${serial}) has not finished booting`, 'Wait for it, or run setup-parity-emu.mjs without --check (it waits).');
      return finish();
    }
    fail(`${name} (${serial}) did not finish booting`, 'Run the script again; read the emulator log if it keeps failing.');
  }

  // 3. The pins: the display as the profile says, night mode, font scale, gesture navigation, demo mode.
  const pin = (rule, isOk, describe, fixArgs, applied) => {
    if (isOk) return;
    if (options.check) problem(rule, describe, 'Run setup-parity-emu.mjs without --check.');
    else {
      for (const words of fixArgs) sh(...words);
      step(applied);
    }
  };
  const size = sh('wm', 'size').stdout;
  const wantSize = `${device.pixels.width}x${device.pixels.height}`;
  if (!size.includes(`Physical size: ${wantSize}`)) problem('emu-wrong-geometry', `the display is "${size.trim().split('\n')[0]}", not ${wantSize}`, `Shut down your own emulator (adb -s ${serial} emu kill) and run this script again.`);
  pin('emu-size', !/Override size/.test(size), `the display size is overridden (${size.trim().split('\n').find((l) => /Override/.test(l))})`, [['wm', 'size', 'reset']], 'wm size reset');
  const density = sh('wm', 'density').stdout;
  const wantDensity = String(device.scale * 160);
  if (!density.includes(`Physical density: ${wantDensity}`)) problem('emu-wrong-geometry', `the density is "${density.trim().split('\n')[0]}", not ${wantDensity} (${device.scale}.0)`, `Shut down your own emulator (adb -s ${serial} emu kill) and run this script again.`);
  pin('emu-density', !/Override density/.test(density), `the density is overridden (${density.trim().split('\n').find((l) => /Override/.test(l))})`, [['wm', 'density', 'reset']], 'wm density reset');
  const night = /Night mode: (\w+)/.exec(sh('cmd', 'uimode', 'night').stdout)?.[1] ?? '?';
  pin('emu-night-mode', night === NIGHT[options.appearance], `night mode is "${night}", not "${NIGHT[options.appearance]}" (appearance ${options.appearance})`, [['cmd', 'uimode', 'night', NIGHT[options.appearance]]], `night mode ${NIGHT[options.appearance]} (was "${night}")`);
  const fontScale = sh('settings', 'get', 'system', 'font_scale').stdout.trim();
  pin('emu-font-scale', fontScale === device.fontScale || fontScale === 'null', `font_scale is ${fontScale}, not ${device.fontScale}`, [['settings', 'put', 'system', 'font_scale', device.fontScale]], `font_scale ${device.fontScale} (was "${fontScale}")`);
  const overlay = device.navigationBar.overlay;
  const gestural = sh('cmd', 'overlay', 'list').stdout.split('\n').some((line) => line.trim() === `[x] ${overlay}`);
  pin('emu-navigation', gestural, `gesture navigation is off (${overlay} not enabled), so the bottom inset is not ${device.navigationBar.height} dp`, [['cmd', 'overlay', 'enable-exclusive', '--category', overlay]], 'gesture navigation on');
  const demoAllowed = sh('settings', 'get', 'global', 'sysui_demo_allowed').stdout.trim();
  pin('emu-demo-mode', demoAllowed === '1', `demo mode is not allowed (sysui_demo_allowed ${demoAllowed}), so the real clock, battery and notifications show`, demoModeCommands(device), 'demo mode on (09:41, full battery, Wi-Fi, no notifications)');
  if (!options.check && demoAllowed === '1') for (const words of demoModeCommands(device)) sh(...words);
  report.note(`serial ${serial}`);
  return finish();
});

/** config.ini's lines, without empty ones. */
function readAvdLines(path) {
  return readFileSync(path, 'utf8').split('\n').filter(Boolean);
}
