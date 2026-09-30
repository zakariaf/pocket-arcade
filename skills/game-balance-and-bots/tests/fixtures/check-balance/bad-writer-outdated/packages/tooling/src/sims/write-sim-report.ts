// packages/tooling/src/sims/write-sim-report.ts
// Node side of the bot simulations: the fingerprint that ties a report to the code it measured,
// and the report file itself (reports/sim/<game-id>.json, gitignored, identical bytes on a rerun).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, sep } from 'node:path';

import type { SimReport } from '@e07/game-kit/testing/balance-bands.ts';

const KIT_SOURCE = 'packages/game-kit/src';
const KIT_ALIAS = '@e07/game-kit/';
/** Every quoted specifier after `from` or `import` (static, side-effect and dynamic imports). */
const SPECIFIER = /\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

/**
 * The folders whose every source can change a bot result: the game's logic and bots and the sim
 * file. game-kit counts only as far as they import it (fingerprintFiles), so a later build step
 * that adds board or gesture files to game-kit leaves the report fresh.
 */
export function fingerprintFolders(gameId: string): readonly string[] {
  return [
    `apps/${gameId}/src/rules`,
    `apps/${gameId}/src/levels`,
    `apps/${gameId}/src/sim`,
    `apps/${gameId}/src/testing`,
    `test/sims/${gameId}`,
  ];
}

/** Source files count; unit tests and snapshots do not (sim tests do: they choose the seeds). */
function isFingerprinted(path: string): boolean {
  if (path.endsWith('.sim.test.ts')) return true;
  if (/\.test\.tsx?$/.test(path) || path.includes('.snap')) return false;
  return /\.(ts|tsx|json)$/.test(path) && !path.endsWith('balance-bands.json');
}

function isFile(root: string, path: string): boolean {
  return existsSync(join(root, path)) && statSync(join(root, path)).isFile();
}

function filesUnder(root: string, folder: string): string[] {
  const base = join(root, folder);
  if (!existsSync(base)) return [];
  return readdirSync(base, { recursive: true, encoding: 'utf8' })
    .map((path) => `${folder}/${path.split(sep).join('/')}`)
    .filter((path) => isFingerprinted(path) && isFile(root, path));
}

/** The game-kit file a specifier in `from` names, or null (another package or a game folder). */
function kitTarget(from: string, specifier: string): string | null {
  if (specifier.startsWith(KIT_ALIAS)) return `${KIT_SOURCE}/${specifier.slice(KIT_ALIAS.length)}`;
  if (!specifier.startsWith('.')) return null;
  const target = posix.normalize(posix.join(posix.dirname(from), specifier));
  return target.startsWith(`${KIT_SOURCE}/`) ? target : null;
}

/** The game-kit files `starts` import, followed through game-kit's own imports (source scan). */
function kitClosure(root: string, starts: readonly string[]): string[] {
  const seen = new Set<string>();
  const queue = [...starts];
  // for...of also visits the files pushed while it runs: a breadth-first walk of the imports.
  for (const from of queue) {
    for (const match of readFileSync(join(root, from), 'utf8').matchAll(SPECIFIER)) {
      const target = kitTarget(from, match[1] ?? '');
      if (target === null || seen.has(target)) continue;
      if (!isFingerprinted(target) || !isFile(root, target)) continue;
      seen.add(target);
      queue.push(target);
    }
  }
  return [...seen];
}

/** Every file the fingerprint hashes, sorted by repo-relative path. */
function fingerprintFiles(gameId: string, root: string = process.cwd()): readonly string[] {
  const own = fingerprintFolders(gameId).flatMap((folder) => filesUnder(root, folder));
  return [...own, ...kitClosure(root, own)].sort();
}

/** sha256 over "<repo-relative path>\n<bytes>\n" of every fingerprinted file, sorted by path. */
export function rulesFingerprint(gameId: string, root: string = process.cwd()): string {
  const hash = createHash('sha256');
  for (const path of fingerprintFiles(gameId, root)) {
    hash.update(`${path}\n`);
    hash.update(readFileSync(join(root, path)));
    hash.update('\n');
  }
  return hash.digest('hex');
}

/** Writes reports/sim/<gameId>.json (two-space JSON, trailing newline) and returns its path. */
export function writeSimReport(report: SimReport, root: string = process.cwd()): string {
  const dir = join(root, 'reports', 'sim');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${report.gameId}.json`);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  return path;
}
