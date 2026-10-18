// packages/tooling/src/e2e/run-e2e-android.ts
// device-only: covered by npm run e2e:android on e07-android-* emulators, then check-e2e-report --platform android
// `npm run e2e:android -- --app <game-id> [--avd <purpose>] [--driver-port <n>] [--apk <apk>] [--flows-only] [--write-perf-baseline] [--include-tags <tags>]`
// (--help prints every option, android-cli.ts). The same flows as e2e:ios, unchanged, on this
// session's own emulators e07-android-<purpose> (default e07-android-e2e-phone and -e2e-tablet),
// every adb call and every Maestro run naming the emulator's serial (Maestro also a driver port of
// its own). Needs a Release APK of the test variant with ADS_MODE=off (readApkApp refuses any
// other: with ads off no consent form, tracking prompt or ad socket exists). While one socket
// sampler per emulator watches the app's uid (sample-sockets-android.ts):
// 1. flows, with the offline journeys under real airplane mode (android-flow-steps.ts);
// 2-3. cold start and memory with the feedback evidence (emu-perf-steps.ts);
// 4. large text: the a11y flows at font_scale 2.0 in en and fa, phone and tablet.
// Then every sampler is proven alive (network-samplers.json) and network.txt must be empty (N3).
// Writes reports/e2e-android/<game-id>/: junit.xml, network.txt, network-samplers.json,
// save-benchmark.json, cold-start.json, memory.json, feedback.json, large-text/<device>-<lang>/.
// --flows-only (iterating) runs step 1 only; it is never the evidence run.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { SAMPLER_PROOF_WAIT_MS } from '@e07/tooling/audit/network-runtime-layer.ts';
import {
  ANDROID_E2E_USAGE,
  parseAndroidE2eCli,
  type AndroidE2eOptions,
} from '@e07/tooling/e2e/android-cli.ts';
import { DEFAULT_FONT_SCALE, fontScaleArgs } from '@e07/tooling/e2e/android-device-args.ts';
import {
  adbOn,
  androidEnv,
  perfLogReader,
  readApkApp,
  startE2eEmulator,
  type AndroidApp,
} from '@e07/tooling/e2e/android-e2e-device.ts';
import {
  runAndroidFlows,
  runAndroidLargeText,
  type AndroidRun,
} from '@e07/tooling/e2e/android-flow-steps.ts';
import { runEmuPerfSteps } from '@e07/tooling/e2e/emu-perf-steps.ts';
import { freeDriverPort } from '@e07/tooling/e2e/maestro-args.ts';
import {
  proveSamplersAlive,
  trackSampler,
  type RunningSampler,
} from '@e07/tooling/e2e/sampler-evidence.ts';

const SOCKET_SAMPLER = join('packages', 'tooling', 'src', 'e2e', 'sample-sockets-android.ts');

type Samplers = {
  readonly watch: (serial: string) => void;
  readonly stop: () => Promise<string[]>;
};

/** One sampler per emulator of the run (sample-sockets-android.ts <package> <report> <serial>). */
function socketSamplers(app: AndroidApp, network: string): Samplers {
  const samplers: RunningSampler[] = [];
  return {
    watch: (serial) => {
      const args = [SOCKET_SAMPLER, app.id, network, serial];
      samplers.push(trackSampler(serial, spawn(process.execPath, args, { stdio: 'inherit' })));
    },
    stop: () => proveSamplersAlive(samplers, network, () => delay(SAMPLER_PROOF_WAIT_MS)),
  };
}

async function evidenceSteps(run: AndroidRun): Promise<string[]> {
  const failures = await runAndroidFlows(run);
  if (run.cli.isFlowsOnly) return failures;
  const { game, isWritingBaseline } = run.cli;
  const { phone: device, maestro, app, out, readLog } = run;
  const input = { game, device, maestro, app, out, isWritingBaseline, readLog };
  failures.push(...(await runEmuPerfSteps(input)));
  failures.push(...(await runAndroidLargeText(run)));
  return failures;
}

/** Maestro, the APK, the phone emulator and an empty reports folder. */
async function startRun(cli: AndroidE2eOptions): Promise<Omit<AndroidRun, 'watch'>> {
  execFileSync('bash', [join('packages', 'tooling', 'scripts', 'install-maestro.sh')], {
    stdio: 'ignore',
  });
  const env = androidEnv();
  const app = readApkApp(cli.game, cli.apk);
  const request = { purpose: cli.phoneAvd, device: 'phone' as const, app, game: cli.game };
  const phone = startE2eEmulator(request, env);
  adbOn(phone, fontScaleArgs(phone.serial, DEFAULT_FONT_SCALE));
  const readLog = perfLogReader(phone, app, join('apps', cli.game, 'build', 'emu-e2e-save'));
  const out = join('reports', 'e2e-android', cli.game);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const maestro = { serial: phone.serial, driverPort: cli.driverPort ?? (await freeDriverPort()) };
  console.log(`e2e:android: phone ${phone.serial}; every adb call and Maestro run names it`);
  return { cli, env, app, phone, maestro, out, readLog };
}

async function main(): Promise<number> {
  const parsed = parseAndroidE2eCli(process.argv.slice(2));
  if (parsed.kind !== 'run') {
    const usage = `${ANDROID_E2E_USAGE.split('\n')[0] ?? ''}\n(--help lists every option)`;
    if (parsed.kind === 'help') console.log(ANDROID_E2E_USAGE);
    else console.error(`e2e:android: ${parsed.message}\n${usage}`);
    return parsed.kind === 'help' ? 0 : 2;
  }
  const started = await startRun(parsed.options);
  // An empty network.txt is the evidence, from samplers proven alive through every step.
  const network = join(started.out, 'network.txt');
  writeFileSync(network, '');
  const sockets = socketSamplers(started.app, network);
  sockets.watch(started.phone.serial);
  const failures: string[] = [];
  try {
    failures.push(...(await evidenceSteps({ ...started, watch: sockets.watch })));
  } finally {
    failures.push(...(await sockets.stop()));
  }
  if (readFileSync(network, 'utf8').trim() !== '') {
    failures.push(`network: the app opened non-loopback sockets (spec N3), see ${network}`);
  }
  for (const failure of failures) console.error(`e2e:android: ${failure}`);
  return failures.length === 0 ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    // A missing or ads-on APK, no JDK 17 or SDK part, or no Maestro: the message, exit 2.
    console.error(`e2e:android: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  });
