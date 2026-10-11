// packages/tooling/src/e2e/maestro-args.ts
// The one way repo tooling points Maestro at a simulator. Every spawn of tools/maestro/bin/maestro
// starts with maestroGlobalArgs(...): the global --device <udid> and --driver-host-port <port>
// BEFORE the command (test, hierarchy, ...). The per-command --udid alone and the default driver
// port 7001 let a run reach whichever simulator's XCTest driver already listens there: in round 3
// a hierarchy call answered from another session's simulator. check-e2e-setup and check-sim-setup
// (rule maestro-device) fail any other spawn.
import { createServer } from 'node:net';

/** Where one Maestro run goes: this simulator, and the host port of this run's own XCTest driver. */
export type MaestroTarget = {
  /** The simulator's UDID from simctl (never "booted", a name or a comma-separated list). */
  readonly udid: string;
  /** freeDriverPort() for each run, or the port a session passes on purpose (--driver-port). */
  readonly driverPort: number;
};

const UDID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
const MIN_PORT = 1024;
const MAX_PORT = 65_535;

function assertUdid(udid: string): void {
  if (!UDID.test(udid)) {
    throw new Error(
      `maestro: "${udid}" is not a simulator UDID; pass the UDID that ensureSimulator returned, never the word booted or a simulator name`,
    );
  }
}

function assertPort(port: number): void {
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(
      `maestro: driver port ${String(port)} is not a port from ${String(MIN_PORT)} to ${String(MAX_PORT)}`,
    );
  }
}

/** The global arguments that go before the Maestro command: this device and this run's driver port. */
export function maestroGlobalArgs(target: MaestroTarget): string[] {
  assertUdid(target.udid);
  assertPort(target.driverPort);
  return ['--device', target.udid, '--driver-host-port', String(target.driverPort)];
}

/** A port nobody listens on right now: the system picks it (listen on port 0), then it is released. */
export function freeDriverPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen({ port: 0, host: '127.0.0.1' }, () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => {
        if (port === 0) reject(new Error('maestro: the system gave no free port'));
        else resolve(port);
      });
    });
  });
}

/** --driver-port <n> when a session passes its own port; otherwise a free port for this run. */
export async function driverPortFor(given: string | undefined): Promise<number> {
  if (given === undefined) return freeDriverPort();
  const port = Number(given);
  assertPort(port);
  return port;
}

/** One line for the run's log: which simulator and driver port a Maestro command went to. */
export function maestroRunLine(target: MaestroTarget, command: readonly string[]): string {
  const shown = command.slice(0, 2).join(' ');
  return `maestro: device ${target.udid}, driver port ${String(target.driverPort)}: ${shown}`;
}
