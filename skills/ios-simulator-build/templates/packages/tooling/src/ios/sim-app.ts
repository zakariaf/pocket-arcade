// packages/tooling/src/ios/sim-app.ts
// A built simulator app and its data: Info.plist values (bundle id, URL scheme, executable) and the
// test build's perf log in the data container's save.db, read with macOS's plutil and sqlite3.
// build:ios:sim waits on the perf log; e2e-maestro's runners read the app and its perf log here.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function readPlistValue(plist: string, keyPath: string): string {
  return execFileSync('plutil', ['-extract', keyPath, 'raw', '-o', '-', plist], {
    encoding: 'utf8',
  }).trim();
}

const infoPlistOf = (appPath: string): string => join(appPath, 'Info.plist');

export function readBundleId(appPath: string): string {
  return readPlistValue(infoPlistOf(appPath), 'CFBundleIdentifier');
}

/** The app's URL scheme (the debug link's <scheme>://debug/setup?...). */
export function readUrlScheme(appPath: string): string {
  return readPlistValue(infoPlistOf(appPath), 'CFBundleURLTypes.0.CFBundleURLSchemes.0');
}

/** CFBundleExecutable: the process name the socket sampler and pgrep look for. */
export function readExecutableName(appPath: string): string {
  return readPlistValue(infoPlistOf(appPath), 'CFBundleExecutable');
}

/** The save database inside the app's data container (simctl get_app_container ... data). */
export function saveDatabaseOf(dataContainer: string): string {
  return join(dataContainer, 'Documents', 'SQLite', 'save.db');
}

/**
 * The perf log's payload in a test build's save.db (a JSON array of entries), or null without one:
 * no save.db yet, no perf_log table (store builds, early Shells) or no row.
 */
export function readPerfLogPayload(database: string): string | null {
  if (!existsSync(database)) return null;
  const result = spawnSync('sqlite3', [database, 'SELECT payload FROM perf_log WHERE id = 1'], {
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout : null;
}
