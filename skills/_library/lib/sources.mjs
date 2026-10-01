// sources.json: which project files each skill file was copied from, with the sha256 at copy time.
// Library-only; skills never read it.

import { closeSync, existsSync, linkSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { basename } from 'node:path';

import { UsageError } from '../shared/scripts/check-lib.mjs';

export const SOURCES_VERSION = 1;
/** A lock older than this is left over from a crashed writer and is broken with a warning. */
export const LOCK_STALE_MS = 10 * 60 * 1000;
/** How long a writer waits for a fresh lock before it stops with exit 2 (record-sources --lock-wait). */
export const LOCK_WAIT_MS = 60 * 1000;

/**
 * Format:
 * {
 *   "version": 1,
 *   "skills": {
 *     "<skill folder name, or _library>": {
 *       "<path inside the skill>": {
 *         "recorded": "YYYY-MM-DD",
 *         "sources": [ { "path": "<repo-relative path>", "sha256": "<hex>" } ]
 *       }
 *     }
 *   }
 * }
 */
export function readSources(path) {
  if (!existsSync(path)) return { version: SOURCES_VERSION, skills: {} };
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new UsageError(`${path} is not valid JSON: ${error.message}`, 'Fix the JSON (or restore it from git).');
  }
  const problems = [];
  if (data.version !== SOURCES_VERSION) problems.push(`"version" must be ${SOURCES_VERSION}`);
  if (!data.skills || typeof data.skills !== 'object' || Array.isArray(data.skills)) problems.push('"skills" must be an object');
  else {
    for (const [skill, files] of Object.entries(data.skills)) {
      if (!files || typeof files !== 'object' || Array.isArray(files)) {
        problems.push(`skills.${skill} must be an object of files`);
        continue;
      }
      for (const [file, entry] of Object.entries(files)) {
        const where = `skills.${skill}["${file}"]`;
        if (!entry || !Array.isArray(entry.sources) || entry.sources.length === 0) problems.push(`${where}.sources must be a non-empty array`);
        else if (entry.sources.some((source) => typeof source?.path !== 'string' || !/^[0-9a-f]{64}$/.test(source?.sha256 ?? ''))) problems.push(`${where}.sources items need "path" and a 64-hex "sha256"`);
        if (typeof entry?.recorded !== 'string') problems.push(`${where}.recorded must be a date string`);
      }
    }
  }
  if (problems.length) throw new UsageError(`${path} has the wrong shape: ${problems.join('; ')}`, 'Record entries with record-sources.mjs instead of editing by hand.');
  return data;
}

function sortObject(object) {
  return Object.fromEntries(Object.keys(object).sort().map((key) => [key, object[key]]));
}

/** The sources.json text for data: skills and files sorted, two-space JSON, one trailing newline. */
export function formatSources(data) {
  const skills = sortObject(Object.fromEntries(Object.entries(data.skills).map(([skill, files]) => [skill, sortObject(files)])));
  const out = {
    $comment: 'Which project files each skill file was copied from, with the sha256 at copy time. Written by record-sources.mjs; read by check-staleness.mjs. Paths are relative to the repo root (sources) and to the skill folder (files); the _library key holds the library shared folder.',
    version: SOURCES_VERSION,
    skills,
  };
  return `${JSON.stringify(out, null, 2)}\n`;
}

/** Writes sources.json atomically: a temporary file next to it, then a rename over it. */
export function writeSources(path, data) {
  const temporary = `${path}.tmp-${process.pid}-${Math.random().toString(16).slice(2, 10)}`;
  writeFileSync(temporary, formatSources(data));
  renameSync(temporary, path);
}

/** Today's local calendar day (YYYY-MM-DD): the day the owner sees, never the UTC day. */
export function localDay(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function readLock(lockPath) {
  try {
    return JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    return null;
  }
}

/** Breaks a stale lock by renaming it away; a lock that turns out to be fresh is put back. */
function breakStaleLock(lockPath, stale, token, log) {
  const broken = `${lockPath}.broken-${token}`;
  try {
    renameSync(lockPath, broken);
  } catch {
    return;
  }
  const taken = readLock(broken);
  if (stale !== null && taken?.token !== stale.token) {
    try {
      linkSync(broken, lockPath);
    } catch {
      // Someone else holds the lock now; their lock is the one that counts.
    }
    unlinkSync(broken);
    return;
  }
  unlinkSync(broken);
  const who = stale ? `${stale.holder ?? 'a writer'} (pid ${stale.pid ?? '?'}) since ${stale.since ?? '?'}` : 'an unknown writer';
  log(`WARN ${basename(lockPath)} held by ${who} is older than ${Math.round(LOCK_STALE_MS / 60000)} minutes; broke it (a crashed writer leaves one behind)`);
}

/**
 * The one safe way to change sources.json while other sessions may write it too:
 *  1. take the exclusive lock <path>.lock (created with O_EXCL, so only one writer holds it);
 *  2. re-read the file under the lock, so entries other writers recorded meanwhile are kept;
 *  3. let update(data) change only its own entries (one skill's files);
 *  4. write atomically (temporary file, then rename) and release the lock.
 * A lock older than LOCK_STALE_MS is broken with a warning. A fresh lock is waited for (polling)
 * up to waitMs; then the writer stops with exit 2 and says who holds it.
 * SOURCES_LOCK_HOLD_MS (library self-test only) keeps the lock that long after the re-read.
 */
export function updateSourcesLocked(path, update, { waitMs = LOCK_WAIT_MS, holder = 'record-sources', log = (line) => console.log(line) } = {}) {
  const lockPath = `${path}.lock`;
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  const started = Date.now();
  for (;;) {
    try {
      const fd = openSync(lockPath, 'wx');
      writeSync(fd, `${JSON.stringify({ token, pid: process.pid, holder, since: new Date().toISOString() })}\n`);
      closeSync(fd);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw new UsageError(`cannot create ${basename(lockPath)}: ${error.message}`, 'Make the _library folder writable, then rerun.');
    }
    let ageMs;
    try {
      ageMs = Date.now() - statSync(lockPath).mtimeMs;
    } catch {
      continue;
    }
    const current = readLock(lockPath);
    if (ageMs > LOCK_STALE_MS) {
      breakStaleLock(lockPath, current, token, log);
      continue;
    }
    if (Date.now() - started >= waitMs) {
      const who = current ? `${current.holder ?? 'a writer'} (pid ${current.pid ?? '?'}) since ${current.since ?? '?'}` : 'another writer';
      throw new UsageError(
        `${basename(lockPath)} is held by ${who}; waited ${Math.round((Date.now() - started) / 1000)} s for it`,
        `Another session is writing ${basename(path)}. Rerun when it has finished (or pass --lock-wait <seconds> to wait longer); a lock older than ${Math.round(LOCK_STALE_MS / 60000)} minutes is broken automatically. Never delete a fresh lock by hand.`,
      );
    }
    pause(100);
  }
  try {
    const data = readSources(path);
    const hold = Number(process.env.SOURCES_LOCK_HOLD_MS ?? 0);
    if (hold > 0) pause(hold);
    const result = update(data);
    writeSources(path, data);
    return result;
  } finally {
    if (readLock(lockPath)?.token === token) unlinkSync(lockPath);
  }
}
