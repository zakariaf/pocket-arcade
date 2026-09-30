// sources.json: which project files each skill file was copied from, with the sha256 at copy time.
// Library-only; skills never read it.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { UsageError } from '../shared/scripts/check-lib.mjs';

export const SOURCES_VERSION = 1;

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

export function writeSources(path, data) {
  const skills = sortObject(Object.fromEntries(Object.entries(data.skills).map(([skill, files]) => [skill, sortObject(files)])));
  const out = {
    $comment: 'Which project files each skill file was copied from, with the sha256 at copy time. Written by record-sources.mjs; read by check-staleness.mjs. Paths are relative to the repo root (sources) and to the skill folder (files); the _library key holds the library shared folder.',
    version: SOURCES_VERSION,
    skills,
  };
  writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
}
