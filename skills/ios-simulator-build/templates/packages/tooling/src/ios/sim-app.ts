// packages/tooling/src/ios/sim-app.ts
// A built simulator app and its data: Info.plist values (bundle id, URL scheme, executable), the
// expo.extra embedded in EXConstants.bundle, and the test build's perf log in the data container's
// save.db, read with macOS's plutil and sqlite3. build:ios:sim waits on the perf log; e2e-maestro's
// runners, the release's store gate and the StoreKit harness read their plists and extra here.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** `{ isOptional: true }`: a key the plist lacks reads as undefined instead of throwing. */
export type PlistRead = { readonly isOptional: true };

export function readPlistValue(plist: string, keyPath: string): string;
export function readPlistValue(plist: string, keyPath: string, read: PlistRead): string | undefined;
export function readPlistValue(
  plist: string,
  keyPath: string,
  read?: PlistRead,
): string | undefined {
  const result = spawnSync('plutil', ['-extract', keyPath, 'raw', '-o', '-', plist], {
    encoding: 'utf8',
  });
  if (result.status === 0) return result.stdout.trim();
  if (read?.isOptional === true) return undefined;
  throw new Error(`plutil could not read ${keyPath} from ${plist}: ${result.stderr.trim()}`);
}

const infoPlistOf = (appPath: string): string => join(appPath, 'Info.plist');

export function readBundleId(appPath: string): string {
  return readPlistValue(infoPlistOf(appPath), 'CFBundleIdentifier');
}

/**
 * The app's URL scheme (the debug link's <scheme>://debug/setup?...): of a built .app, or of the
 * prebuilt project's ios/<scheme>/ folder, whose Info.plist the build copies.
 */
export function readUrlScheme(appPath: string): string {
  return readPlistValue(infoPlistOf(appPath), 'CFBundleURLTypes.0.CFBundleURLSchemes.0');
}

/** CFBundleExecutable: the process name the socket sampler and pgrep look for. */
export function readExecutableName(appPath: string): string {
  return readPlistValue(infoPlistOf(appPath), 'CFBundleExecutable');
}

/** expo.extra as the build embedded it (EXConstants.bundle/app.config); {} without one. */
export function readAppExtra(appPath: string): Readonly<Record<string, unknown>> {
  const config = readFileSync(join(appPath, 'EXConstants.bundle', 'app.config'), 'utf8');
  return (JSON.parse(config) as { extra?: Record<string, unknown> }).extra ?? {};
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
