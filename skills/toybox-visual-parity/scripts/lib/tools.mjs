// Runs xcrun simctl and maestro. Every call goes through here so the self-test can swap in fake
// tools (a path ending in .mjs runs with this Node); the real tools are found as below.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { fail } from '../check-lib.mjs';

function exec(tool, args, { env, timeoutMs = 120000, input } = {}) {
  const isScript = /\.m?js$/.test(tool);
  const result = spawnSync(isScript ? process.execPath : tool, isScript ? [tool, ...args] : args, {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: timeoutMs,
    maxBuffer: 128 * 1024 * 1024,
    input,
  });
  if (result.error?.code === 'ENOENT') return { status: 127, stdout: '', stderr: `${tool}: not found` };
  return { status: result.status ?? (result.error ? 1 : 0), stdout: result.stdout ?? '', stderr: `${result.stderr ?? ''}${result.error && result.error.code !== 'ENOENT' ? String(result.error.message) : ''}` };
}

/** The simctl runner: simctl('list', 'devices', '-j'). */
export function makeSimctl(xcrunPath) {
  const tool = xcrunPath || process.env.PARITY_XCRUN || 'xcrun';
  const simctl = (...args) => exec(tool, ['simctl', ...args]);
  simctl.tool = tool;
  simctl.json = (...args) => {
    const r = simctl(...args);
    if (r.status !== 0) fail(`xcrun simctl ${args.join(' ')} failed (${r.status}): ${r.stderr.trim().split('\n')[0]}`, 'Install Xcode 26.6 and select it (sudo xcode-select -s /Applications/Xcode.app); this is a human step if Xcode is missing.');
    try {
      return JSON.parse(r.stdout);
    } catch {
      return fail(`xcrun simctl ${args.join(' ')} did not print JSON`, 'Check the Xcode installation.');
    }
  };
  return simctl;
}

/** Java 17 for Maestro: $JAVA_HOME, then Android Studio's bundled JBR, then /usr/libexec/java_home. */
export function findJavaHome() {
  if (process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, 'bin', 'java'))) return process.env.JAVA_HOME;
  const jbr = '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
  if (existsSync(join(jbr, 'bin', 'java'))) return jbr;
  const r = exec('/usr/libexec/java_home', ['-v', '17']);
  return r.status === 0 ? r.stdout.trim() : null;
}

/**
 * The XCUITest driver port for Maestro: --driver-port, else $PARITY_MAESTRO_PORT, else null (Maestro's
 * default 22087). Two sessions on one Mac need two ports, or one session's hierarchy call can be
 * answered by the other simulator's driver.
 */
export function driverPortOf(option) {
  const raw = option ?? process.env.PARITY_MAESTRO_PORT ?? null;
  if (raw === null || raw === '') return null;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) fail(`driver port "${raw}" is not a port number from 1024 to 65535`, 'Pass e.g. --driver-port 22187 (or set PARITY_MAESTRO_PORT).');
  return port;
}

/**
 * The maestro runner, or null when Maestro is not installed. Looked up in this order: --maestro,
 * $PARITY_MAESTRO, $MAESTRO_BIN, the app repo's tools/maestro/bin/maestro (the pinned install),
 * maestro on PATH, ~/.maestro/bin/maestro. With a driver port every call gets
 * --driver-host-port <port> before the command, so this session's driver never answers another's.
 */
export function makeMaestro(maestroPath, { driverPort = null } = {}) {
  let tool = maestroPath || process.env.PARITY_MAESTRO || process.env.MAESTRO_BIN || null;
  const repoInstall = join(process.cwd(), 'tools', 'maestro', 'bin', 'maestro');
  if (!tool && existsSync(repoInstall)) tool = repoInstall;
  if (!tool) {
    const which = exec('/usr/bin/which', ['maestro']);
    if (which.status === 0 && which.stdout.trim()) tool = which.stdout.trim();
  }
  if (!tool && existsSync(join(homedir(), '.maestro', 'bin', 'maestro'))) tool = join(homedir(), '.maestro', 'bin', 'maestro');
  if (!tool) return null;
  const isFake = /\.m?js$/.test(tool);
  const javaHome = isFake ? null : findJavaHome();
  const env = { MAESTRO_CLI_NO_ANALYTICS: 'true', MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true', MAESTRO_DISABLE_UPDATE_CHECK: 'true', ...(javaHome ? { JAVA_HOME: javaHome } : {}) };
  const portArgs = driverPort ? ['--driver-host-port', String(driverPort)] : [];
  const maestro = (...args) => exec(tool, [...portArgs, ...args], { env, timeoutMs: 180000 });
  maestro.tool = tool;
  maestro.driverPort = driverPort;
  maestro.javaHome = javaHome;
  return maestro;
}

/** Find the dedicated parity simulator by name. Returns { device, runtime } or null. */
export function findSimulator(simctl, name) {
  const list = simctl.json('list', 'devices', '-j');
  const matches = [];
  for (const [runtime, devices] of Object.entries(list.devices ?? {})) {
    for (const d of devices) if (d.name === name) matches.push({ device: d, runtime });
  }
  return matches;
}

export const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
