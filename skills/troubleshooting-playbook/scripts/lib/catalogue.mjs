// catalogue.mjs: loads, validates and renders the known-failures catalogue
// (assets/known-failures.json). The area references in references/ are rendered from it, so the
// JSON is the one place an entry is written.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fail } from '../check-lib.mjs';

export const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_CATALOGUE = join(SKILL_DIR, 'assets', 'known-failures.json');
export const DEFAULT_REFERENCES = join(SKILL_DIR, 'references');
export const STATUSES = ['verified', 'documented', 'open'];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function loadCatalogue(path) {
  if (!existsSync(path)) fail(`nothing to check: catalogue ${path} does not exist`, 'Pass --catalogue <known-failures.json>.');
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${path} is not valid JSON (${error.message})`, 'Fix the JSON syntax; every entry is one object in "entries".');
  }
  return null;
}

const TEXT_FIELDS = ['topic', 'symptom', 'cause', 'fix'];

function entryProblems(entry, index, areas) {
  const problems = [];
  const where = `entries[${index}]${typeof entry?.id === 'string' ? ` (${entry.id})` : ''}`;
  const add = (rule, message, fix) => problems.push({ where, rule, message, fix });
  if (typeof entry !== 'object' || entry === null) return [{ where, rule: 'entry-shape', message: 'is not an object', fix: 'Each entry is { id, area, topic, symptom, cause, fix, match, status, owner, skill }.' }];
  if (!(entry.area in areas)) add('entry-area', `area "${entry.area}" is not one of ${Object.keys(areas).join(', ')}`, 'Use an existing area, or add the area to "areas" with a title, file and intro.');
  if (typeof entry.id !== 'string' || !KEBAB.test(entry.id) || !entry.id.startsWith(`${entry.area}-`)) add('entry-id', `id "${entry.id}" is not kebab-case "<area>-<slug>"`, 'Name it <area>-<what-failed>, for example build-metro-cache-variant.');
  for (const field of TEXT_FIELDS) {
    if (typeof entry[field] !== 'string' || entry[field].trim().length < 3) add('entry-text', `${field} is missing or empty`, 'Write the symptom as the text you see, the cause as why, and the fix as the action.');
  }
  if (!Array.isArray(entry.match)) add('entry-match', 'match is not an array of regular expressions', 'Use [] when there is no error text to match.');
  else {
    for (const pattern of entry.match) {
      try {
        new RegExp(pattern);
      } catch (error) {
        add('entry-match', `match pattern ${JSON.stringify(pattern)} does not compile (${error.message})`, 'Escape backslashes twice in JSON ("\\\\d").');
      }
    }
  }
  if (!STATUSES.includes(entry.status)) add('entry-status', `status "${entry.status}" is not one of ${STATUSES.join(', ')}`, 'verified = seen and fixed in a run; documented = read in the tool\'s source or docs; open = not settled.');
  if (typeof entry.owner !== 'boolean') add('entry-owner', 'owner is not true or false', 'owner: true when the fix needs the owner (stop and ask).');
  if (entry.skill !== null && (typeof entry.skill !== 'string' || !KEBAB.test(entry.skill))) add('entry-skill', `skill "${entry.skill}" is not a skill name or null`, 'Name the skill that owns the full procedure, or null.');
  return problems;
}

/** Every structural problem of the catalogue as { where, rule, message, fix }. */
export function validateCatalogue(catalogue) {
  const problems = [];
  if (catalogue?.version !== 1) problems.push({ where: 'version', rule: 'catalogue-shape', message: 'version is not 1', fix: 'Keep "version": 1.' });
  const areas = catalogue?.areas && typeof catalogue.areas === 'object' ? catalogue.areas : {};
  if (Object.keys(areas).length === 0) problems.push({ where: 'areas', rule: 'catalogue-shape', message: 'no areas', fix: 'Add "areas": { "<id>": { "title", "file", "intro" } }.' });
  for (const [id, area] of Object.entries(areas)) {
    if (!KEBAB.test(id) || typeof area?.title !== 'string' || typeof area?.intro !== 'string' || !/^references\/[a-z0-9-]+\.md$/.test(area?.file ?? '')) {
      problems.push({ where: `areas.${id}`, rule: 'catalogue-shape', message: 'needs a kebab id, a title, an intro and a file references/<name>.md', fix: 'Complete the area object.' });
    }
  }
  const entries = Array.isArray(catalogue?.entries) ? catalogue.entries : [];
  if (entries.length === 0) problems.push({ where: 'entries', rule: 'catalogue-shape', message: 'no entries', fix: 'Add at least one entry.' });
  const seen = new Set();
  entries.forEach((entry, index) => {
    problems.push(...entryProblems(entry, index, areas));
    if (typeof entry?.id === 'string') {
      if (seen.has(entry.id)) problems.push({ where: `entries[${index}] (${entry.id})`, rule: 'entry-duplicate', message: `id ${entry.id} is used twice`, fix: 'Merge the two entries, or give one a more specific id.' });
      seen.add(entry.id);
    }
  });
  return problems;
}

function cell(text) {
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** The markdown reference for one area, rendered from the catalogue. */
export function renderArea(catalogue, areaId) {
  const area = catalogue.areas[areaId];
  const entries = catalogue.entries.filter((entry) => entry.area === areaId);
  const topics = [...new Set(entries.map((entry) => entry.topic))];
  const lines = [
    `# ${area.title}`,
    '',
    `${area.intro} Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.`,
    '',
    '<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->',
    '',
    '## Contents',
    '',
    ...topics.map((topic) => `- ${topic}`),
  ];
  for (const topic of topics) {
    lines.push('', `## ${topic}`, '', '| ID | Symptom | Cause | Fix | Status | Skill |', '|---|---|---|---|---|---|');
    for (const entry of entries.filter((item) => item.topic === topic)) {
      const status = entry.owner ? `${entry.status}, owner` : entry.status;
      const skill = entry.skill ? `\`${entry.skill}\`` : '';
      lines.push(`| \`${entry.id}\` | ${cell(entry.symptom)} | ${cell(entry.cause)} | ${cell(entry.fix)} | ${status} | ${skill} |`);
    }
  }
  return `${lines.join('\n')}\n`;
}
