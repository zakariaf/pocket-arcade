// android-device.mjs: the Android emulator side of kill-test.mjs and inspect-save.mjs. Every adb call
// names its device (`adb -s <serial>`); the only AVD this file creates or deletes is
// e07-android-kill-test, on the shared pinned google_apis image (android-emu.mjs: a Play Store image
// refuses `adb root`, so the Release app's files/SQLite/ folder could not be read). The SDK lookup,
// the device list, the console ports and the sleep are android-emu.mjs's, shared with
// toybox-visual-parity. The pure helpers are proven by the self-test;
// the commands run against tests/fixtures/kill-test/fake-sdk there and never against a real device.

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FIRST_CONSOLE_PORT, LAST_CONSOLE_PORT, SYSTEM_IMAGE, freeConsolePort, readySerials, sleepMs } from './android-emu.mjs';

/** The one AVD the kill test owns: created for a --create run and deleted at its end. */
export const KILL_TEST_AVD = 'e07-android-kill-test';
/** The device profile of every e07-android-* AVD. */
export const AVD_DEVICE = 'pixel_8';
/** How long a cold boot of a new AVD may take before the run stops. */
export const BOOT_TIMEOUT_MS = 240_000;

const SDK_TOOLS = {
  adb: ['platform-tools', 'adb'],
  emulator: ['emulator', 'emulator'],
  avdmanager: ['cmdline-tools', 'latest', 'bin', 'avdmanager'],
};

/** Absolute paths of adb, emulator and avdmanager inside the SDK. */
export function sdkTools(sdk) {
  return Object.fromEntries(Object.entries(SDK_TOOLS).map(([name, parts]) => [name, join(sdk, ...parts)]));
}

/** The SDK parts a run needs that are missing (the image only for --create), as printable names. */
export function missingSdkParts(sdk, { create }) {
  const missing = Object.values(SDK_TOOLS).map((parts) => parts.join('/')).filter((rel) => !existsSync(join(sdk, rel)));
  const imageDir = join(sdk, ...SYSTEM_IMAGE.split(';'));
  if (create && !existsSync(imageDir)) missing.push(`${SYSTEM_IMAGE.split(';').join('/')} (sdkmanager "${SYSTEM_IMAGE}")`);
  return missing;
}

/** The adb arguments for one device: -s <serial> always comes before the command. */
export function adbArgs(serial, args) {
  return ['-s', serial, ...args];
}

/** The app's save folder on the device: expo-sqlite's SQLite/ in the app's files directory. */
export function androidSaveDir(packageId) {
  return `/data/data/${packageId}/files/SQLite/`;
}

/**
 * Where save.db lands after `adb -s <serial> pull <device>/SQLite/ <dest>`: adb puts the folder itself inside an
 * existing <dest> (dest/SQLite/save.db), and copies its contents when <dest> did not exist
 * (dest/save.db). The first that exists, else the first.
 */
export function pulledSaveDb(dest, exists = existsSync) {
  const candidates = [join(dest, 'SQLite', 'save.db'), join(dest, 'save.db')];
  return candidates.find((path) => exists(path)) ?? candidates[0];
}

/** `stat -c '%s %Y'` output as { size, mtime }, or null when the file does not exist. */
export function parseStat(text) {
  const match = /^(\d+)\s+(\d+)\s*$/.exec(String(text ?? '').trim());
  return match === null ? null : { size: Number(match[1]), mtime: Number(match[2]) };
}

/**
 * Whether the WAL shows a save write made after the launch: a non-empty file that did not exist
 * before the launch, or whose size or modification time changed since (the device clock is not the
 * host's, so the before/after pair is compared instead of a launch time).
 */
export function isAndroidWalWrite(before, after) {
  if (after === null || after.size === 0) return false;
  return before === null || after.size !== before.size || after.mtime !== before.mtime;
}

/**
 * One kill round as a single device shell line: launch the activity, wait `delayMs` on the device
 * (no adb round trip between launch and kill), then SIGKILL the app's process if it still runs.
 */
export function killRoundScript(packageId, delayMs) {
  const seconds = (delayMs / 1000).toFixed(3).replace(/\.?0+$/, '');
  return `am start -n ${packageId}/.MainActivity >/dev/null 2>&1; sleep ${seconds}; pid=$(pidof ${packageId}); if [ -n "$pid" ]; then kill -9 $pid; echo killed $pid; else echo exited; fi`;
}

/** The pid a round's script reports, or null when the app had already exited. */
export function killedPid(output) {
  const match = /killed (\d+)/.exec(String(output));
  return match === null ? null : Number(match[1]);
}

/** Environment for avdmanager: JAVA_HOME (else Android Studio's JDK 17) and ANDROID_HOME. */
function toolEnv(sdk) {
  const jbr = '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
  const javaHome = process.env.JAVA_HOME ?? (existsSync(jbr) ? jbr : undefined);
  return { ...process.env, ANDROID_HOME: sdk, ...(javaHome === undefined ? {} : { JAVA_HOME: javaHome }) };
}

/**
 * The device side of a run: every command is printed (`run:` or, in a dry run, `would run:`) with the
 * tool's name, so the plan and the log read the same. `fail` is check-lib's fail (exit 2).
 */
export function createAndroidDevice({ sdk, dryRun, fail }) {
  const tools = sdkTools(sdk);
  const env = toolEnv(sdk);
  let serial = '<serial>';

  function exec(tool, args, { allowFail = false, quiet = false, input } = {}) {
    if (!quiet || dryRun) console.log(`${dryRun ? 'would run' : 'run'}: ${tool} ${args.join(' ')}`);
    if (dryRun) return '';
    try {
      return execFileSync(tools[tool], args, { encoding: 'utf8', env, input, stdio: ['pipe', 'pipe', 'pipe'], timeout: 120_000 }).trim();
    } catch (error) {
      if (allowFail) return null;
      fail(`${tool} ${args.join(' ')} failed: ${String(error.stderr || error.message).trim().split('\n')[0]}`, 'Check the SDK (--sdk or ANDROID_HOME), the serial (adb devices) and the package id.');
    }
    return null;
  }

  /** Runs adb with arguments built by adbArgs(serial, [...]); refuses any call that does not name its device first. */
  const adb = (args, options) => {
    if (args[0] !== '-s' || !args[1]) fail(`adb ${args.join(' ')} names no device`, 'Build the arguments with adbArgs(serial, [...]).');
    return exec('adb', args, options);
  };

  return {
    get serial() {
      return serial;
    },
    adb,
    /** Uses a running emulator: it must be listed by `adb devices`. */
    useSerial(given) {
      serial = given;
      if (dryRun) return;
      const listed = readySerials(exec('adb', ['devices'], { quiet: true }) ?? '');
      if (!listed.includes(given)) fail(`${given} is not a running device (adb devices lists: ${listed.join(', ') || 'none'})`, `Start a dedicated e07-android-<purpose> emulator, or pass --create to use ${KILL_TEST_AVD}.`);
    },
    /** Creates (or reuses) e07-android-kill-test, starts it headless on a free port and waits for boot. */
    createAndBoot() {
      const avds = dryRun ? [] : (exec('emulator', ['-list-avds'], { quiet: true }) ?? '').split('\n').map((line) => line.trim());
      if (avds.includes(KILL_TEST_AVD)) console.log(`reusing the AVD ${KILL_TEST_AVD} left by an earlier run`);
      else exec('avdmanager', ['create', 'avd', '--name', KILL_TEST_AVD, '--package', SYSTEM_IMAGE, '--device', AVD_DEVICE], { input: 'no\n' });
      const port = dryRun ? '<port>' : freeConsolePort(readySerials(exec('adb', ['devices'], { quiet: true }) ?? ''));
      if (port === null) fail(`no free emulator console port between ${FIRST_CONSOLE_PORT} and ${LAST_CONSOLE_PORT}`, 'Shut down an emulator this session started (adb -s <serial> emu kill).');
      const args = ['-avd', KILL_TEST_AVD, '-port', String(port), '-no-snapshot', '-no-boot-anim', '-no-audio', '-no-window'];
      console.log(`${dryRun ? 'would run' : 'run'}: emulator ${args.join(' ')} (detached)`);
      if (!dryRun) spawn(tools.emulator, args, { detached: true, stdio: 'ignore', env }).unref();
      serial = dryRun ? '<serial>' : `emulator-${port}`;
      this.waitForBoot();
    },
    /** Polls sys.boot_completed every second until it reads 1 (never a fixed sleep). */
    waitForBoot() {
      if (dryRun) {
        console.log(`would poll: adb -s ${serial} shell getprop sys.boot_completed until 1 (up to ${BOOT_TIMEOUT_MS / 1000} s)`);
        return;
      }
      const startedMs = Date.now();
      while (Date.now() - startedMs < BOOT_TIMEOUT_MS) {
        if (adb(adbArgs(serial, ['shell', 'getprop', 'sys.boot_completed']), { allowFail: true, quiet: true }) === '1') return;
        sleepMs(1000);
      }
      fail(`${serial} did not finish booting within ${BOOT_TIMEOUT_MS / 1000} s`, 'Read the emulator output (run the emulator command by hand) and check the system image.');
    },
    /** adb root, then proves it: a Play Store image answers "cannot run as root" and stays uid 2000. */
    becomeRoot() {
      const answer = adb(adbArgs(serial, ['root']));
      if (dryRun) return;
      adb(adbArgs(serial, ['wait-for-device']), { quiet: true });
      if (/cannot run as root/i.test(answer ?? '') || adb(adbArgs(serial, ['shell', 'id', '-u']), { quiet: true }) !== '0') {
        fail(`adb root was refused on ${serial} (${answer})`, `Use an emulator on the ${SYSTEM_IMAGE} image (google_apis): a google_apis_playstore image never allows adb root, so the Release app's files/SQLite/ folder cannot be read.`);
      }
    },
    /**
     * Pulls the app's save folder (save.db with its -wal and -shm) into a fresh temporary folder.
     * Returns { database, cleanup }: the local save.db and the function that deletes the copy.
     */
    pullSaveDb(packageId) {
      const dest = dryRun ? '<tmp>' : mkdtempSync(join(tmpdir(), 'save-android-'));
      adb(adbArgs(serial, ['pull', androidSaveDir(packageId), dest]));
      return { database: pulledSaveDb(dest), cleanup: () => (dryRun ? undefined : rmSync(dest, { recursive: true, force: true })) };
    },
    /** Shuts the created emulator down by serial, waits until adb no longer lists it, deletes the AVD. */
    teardownCreated() {
      adb(adbArgs(serial, ['emu', 'kill']), { allowFail: true });
      if (!dryRun) {
        const startedMs = Date.now();
        while (Date.now() - startedMs < 60_000 && readySerials(exec('adb', ['devices'], { quiet: true, allowFail: true }) ?? '').includes(serial)) sleepMs(1000);
      }
      exec('avdmanager', ['delete', 'avd', '--name', KILL_TEST_AVD], { allowFail: true });
    },
  };
}
