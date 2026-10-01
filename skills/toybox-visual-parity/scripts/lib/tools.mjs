// Runs xcrun simctl and maestro. Every call goes through here so the self-test can swap in fake
// tools (a path ending in .mjs runs with this Node); the real tools are found as below.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
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
 * The XCUITest driver port a session passed on purpose: --driver-port, else $PARITY_MAESTRO_PORT, else
 * null (capture-app then takes a free port for its run with freeDriverPort()).
 */
export function driverPortOf(option) {
  const raw = option ?? process.env.PARITY_MAESTRO_PORT ?? null;
  if (raw === null || raw === '') return null;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) fail(`driver port "${raw}" is not a port from 1024 to 65535`, 'Pass e.g. --driver-port 22187 (or set PARITY_MAESTRO_PORT).');
  return port;
}

/** A port nobody listens on right now: the system picks it (listen on port 0), then it is released. */
export function freeDriverPort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen({ port: 0, host: '127.0.0.1' }, () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => (port ? resolvePort(port) : reject(new Error('the system gave no free port'))));
    });
  });
}

const UDID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

/**
 * The global arguments that go before every Maestro command, as the repo's e2e helper
 * (packages/tooling/src/e2e/maestro-args.ts) builds them: this simulator's UDID and this run's own
 * XCUITest driver port. Never "booted", a name, or Maestro's default port: in round 3 a hierarchy
 * call answered from another session's simulator.
 */
export function maestroGlobalArgs({ udid, driverPort }) {
  if (!UDID.test(String(udid ?? ''))) fail(`"${udid}" is not a simulator UDID`, 'Pass the UDID of this session\'s own simulator (setup-parity-sim.mjs prints it).');
  if (!Number.isInteger(driverPort) || driverPort < 1024 || driverPort > 65535) fail(`driver port "${driverPort}" is not a port from 1024 to 65535`, 'Pass --driver-port, or let capture-app pick a free one.');
  return ['--device', udid, '--driver-host-port', String(driverPort)];
}

/** One Maestro command with this run's global arguments in front: maestroArgs(target, 'hierarchy'). */
export function maestroArgs(target, ...command) {
  return [...maestroGlobalArgs(target), ...command];
}

/**
 * The maestro runner, or null when Maestro is not installed. Looked up in this order: --maestro,
 * $PARITY_MAESTRO, $MAESTRO_BIN, the app repo's tools/maestro/bin/maestro (the pinned install),
 * maestro on PATH, ~/.maestro/bin/maestro. Every call site builds its arguments with maestroArgs():
 * --device <udid> --driver-host-port <port> before the command.
 */
export function makeMaestro(maestroPath) {
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
  const maestro = (...args) => exec(tool, args, { env, timeoutMs: 180000 });
  maestro.tool = tool;
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
