#!/usr/bin/env node
// check-spec-refs.mjs: checks that every spec citation in the app repo points at something that
// exists (S1-S15, S11a-S11d, N1-N12, D1-D9, spec sections), that "Home (S4)"-style pairs name the
// right screen, and that every apps/<game-id> folder is a catalogue game.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-spec-refs.mjs [repo-root]

import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { createReporter, lineOf, maskComments, parseArgs, readText, requireDir, run, toPosix, walk } from './check-lib.mjs';
import { loadEntries } from './lib/spec-ids.mjs';

const SPEC = {
  name: 'check-spec-refs',
  summary: 'Checks spec citations in source, tests, flows and markdown: every cited ID exists, screen names match their IDs, and app folders are catalogue games.',
  usage: '[options] [repo-root]',
  options: {
    game: { type: 'string', multiple: true, value: 'id', help: 'Accept an extra game id (a game the owner renamed or added)' },
    ignore: { type: 'string', multiple: true, value: 'glob', help: 'Skip matching paths (in addition to node_modules, ios, android, build output and skills)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  unknown-screen-id       a screen ID other than S1-S15 or S11a-S11d (in comments, markdown, yaml, or after "spec")',
    '  unknown-non-negotiable  an N-number other than N1-N12',
    '  unknown-decision        "decision D12" or "spec D12": only D1-D9 exist',
    '  unknown-spec-section    "spec 8.15" or "spec section 18": no such section',
    '  screen-name-mismatch    "Home (S5)": the name and the ID are different screens',
    '  unknown-game-id         apps/<name> is not a catalogue game id (pass --game <id> for an owner-approved one)',
    '',
    'Code files (.ts/.tsx/.js/.mjs): citations after "spec" are checked everywhere; bare S/N IDs only in comments.',
    'Markdown, yaml and text files: everything is checked.',
    '',
    'Example: node check-spec-refs.mjs .',
  ].join('\n'),
};

const INCLUDE = ['*.ts', '*.tsx', '*.js', '*.mjs', '*.cjs', '*.md', '*.yaml', '*.yml', '*.txt'];
const DEFAULT_IGNORE = ['ios', 'android', 'build', 'dist', 'dist-audit', 'coverage', 'reports', '.expo', '.stryker-tmp', 'skills', '*.d.ts'];
const CODE = /\.(ts|tsx|js|mjs|cjs)$/;

// An ID ends at a non-word character, so "spec 2026-09-26" (a date) and "spec 8.8 - 180 s" are not citations.
const ID = String.raw`(?:S\d{1,3}[a-z]?|N\d{1,3}|D\d{1,3}|\d{1,2}(?:\.\d{1,2})?)(?![\w.]\d|\w)`;
const CITATION = new RegExp(String.raw`\bspec(?:'s)?(?:\s+sections?\s+|\s*§\s*|\s+)(${ID}(?:\s*(?:,|and|or|to|-|–|/|&)\s*${ID})*)`, 'gi');
const DECISION = new RegExp(String.raw`\b(?:open\s+)?decisions?\s+(D\d{1,3}(?:\s*(?:,|and|or|to|-|–|/)\s*D\d{1,3})*)`, 'gi');
const BARE = /(?<![A-Za-z0-9_.#/-])([SN])(\d{1,3})([a-z]?)(?![A-Za-z0-9_])/g;

// Screen names as the spec writes them (lowercase) -> the IDs they may stand for.
const SCREEN_NAMES = {
  splash: ['S1'],
  'first-run language choice': ['S2'],
  'language choice': ['S2'],
  language: ['S2', 'S11a'],
  'ad consent and tracking': ['S3'],
  'ad consent': ['S3'],
  consent: ['S3'],
  home: ['S4'],
  'game screen': ['S5'],
  game: ['S5'],
  'pause menu': ['S6'],
  pause: ['S6'],
  'result screen': ['S7'],
  result: ['S7'],
  results: ['S7'],
  levels: ['S8'],
  'daily challenge': ['S9'],
  daily: ['S9'],
  statistics: ['S10'],
  stats: ['S10'],
  settings: ['S11', 'S11a', 'S11b', 'S11c', 'S11d'], // S11a-S11d are pages inside Settings
  'about and credits': ['S11b'],
  about: ['S11b'],
  'privacy policy': ['S11c'],
  licences: ['S11d'],
  licenses: ['S11d'],
  premium: ['S12'],
  'purchase page': ['S12'],
  'how to play': ['S13'],
  tutorial: ['S13'],
  dialogs: ['S14'],
  dialog: ['S14'],
  'debug menu': ['S15'],
  debug: ['S15'],
};
const NAME_ALT = Object.keys(SCREEN_NAMES).sort((a, b) => b.length - a.length).map((name) => name.replace(/ /g, '\\s+')).join('|');
const NAME_THEN_ID = new RegExp(String.raw`\b(${NAME_ALT})\s*\(\s*(S\d{1,3}[a-z]?)\b`, 'gi');
const PAREN_NAME_ID = new RegExp(String.raw`\(\s*(${NAME_ALT})\s*,\s*(S\d{1,3}[a-z]?)\s*\)`, 'gi');
const ID_THEN_NAME = new RegExp(String.raw`\b(S\d{1,3}[a-z]?)\s*\(\s*(${NAME_ALT})\s*\)`, 'gi');

/** Keep only comment characters (everything else becomes a space; newlines stay). */
function commentsOnly(source) {
  const masked = maskComments(source);
  let out = '';
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    out += ch === '\n' ? '\n' : masked[i] === ch ? ' ' : ch;
  }
  return out;
}

function makeChecker(entries) {
  const valid = new Set(entries.map((entry) => entry.id));
  const screenIds = entries.filter((entry) => entry.kind === 'screen').map((entry) => entry.id);
  const titles = new Map(entries.map((entry) => [entry.id, entry.title]));
  const idRule = (id) => (id[0] === 'S' ? 'unknown-screen-id' : id[0] === 'N' ? 'unknown-non-negotiable' : id[0] === 'D' ? 'unknown-decision' : 'unknown-spec-section');
  const canonical = (raw) => {
    const letter = /^([SNDsnd])(\d+)([a-zA-Z]?)$/.exec(raw);
    return letter ? `${letter[1].toUpperCase()}${Number(letter[2])}${letter[3].toLowerCase()}` : raw;
  };
  const fixFor = (rule) =>
    ({
      'unknown-screen-id': `Use one of ${screenIds.join(', ')} (check with spec-lookup.mjs --list).`,
      'unknown-non-negotiable': 'The non-negotiables are N1-N12; look the rule up with spec-lookup.mjs and cite the right one.',
      'unknown-decision': 'The open decisions are D1-D9; look them up with spec-lookup.mjs.',
      'unknown-spec-section': 'Spec sections are 0-17 (for example 7.1-7.6, 8.1-8.14); look the section up with spec-lookup.mjs --list.',
    })[rule];
  return { valid, titles, idRule, canonical, fixFor };
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const report = createReporter({ name: 'check-spec-refs', json: options.json });
  const entries = loadEntries();
  const { valid, titles, idRule, canonical, fixFor } = makeChecker(entries);
  const shown = (rel) => toPosix(relative(process.cwd(), join(root, rel))) || rel;
  const seen = new Set();
  const flag = (rel, text, index, id, rule, message) => {
    const key = `${rel}:${index}:${id}:${rule}`;
    if (seen.has(key)) return;
    seen.add(key);
    report.problem({ file: shown(rel), line: lineOf(text, index), rule, message, fix: fixFor(rule) });
  };
  const checkId = (rel, text, index, raw) => {
    const id = canonical(raw);
    if (!valid.has(id)) flag(rel, text, index, id, idRule(id), `"${raw}" is not in the spec`);
  };

  const files = walk(root, { include: INCLUDE, ignore: [...DEFAULT_IGNORE, ...(options.ignore ?? [])] });
  let checked = 0;
  for (const rel of files) {
    const source = readText(join(root, rel));
    if (source === null) continue;
    checked += 1;
    const bareText = CODE.test(rel) ? commentsOnly(source) : source;
    for (const match of source.matchAll(CITATION)) {
      for (const idMatch of match[1].matchAll(new RegExp(ID, 'gi'))) checkId(rel, source, match.index + match[0].indexOf(match[1]) + idMatch.index, idMatch[0]);
    }
    for (const match of source.matchAll(DECISION)) {
      for (const idMatch of match[1].matchAll(/D\d{1,3}/gi)) checkId(rel, source, match.index + match[0].indexOf(match[1]) + idMatch.index, idMatch[0]);
    }
    for (const match of bareText.matchAll(BARE)) checkId(rel, bareText, match.index, match[0]);
    for (const pattern of [NAME_THEN_ID, PAREN_NAME_ID]) {
      for (const match of source.matchAll(pattern)) {
        const allowed = SCREEN_NAMES[match[1].toLowerCase().replace(/\s+/g, ' ')] ?? [];
        const id = canonical(match[2]);
        if (valid.has(id) && !allowed.includes(id)) {
          flag(rel, source, match.index, id, 'screen-name-mismatch', `"${match[0].trim()}" pairs the name "${match[1]}" with ${id}, which is ${titles.get(id)}`);
        }
      }
    }
    for (const match of source.matchAll(ID_THEN_NAME)) {
      const allowed = SCREEN_NAMES[match[2].toLowerCase().replace(/\s+/g, ' ')] ?? [];
      const id = canonical(match[1]);
      if (valid.has(id) && !allowed.includes(id)) {
        flag(rel, source, match.index, id, 'screen-name-mismatch', `"${match[0].trim()}" pairs ${id} (${titles.get(id)}) with the name "${match[2]}"`);
      }
    }
  }

  const appsDir = join(root, 'apps');
  let appDirs = [];
  try {
    appDirs = statSync(appsDir).isDirectory() ? readdirSync(appsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name) : [];
  } catch {
    appDirs = [];
  }
  const games = new Set([...entries.filter((entry) => entry.kind === 'game').map((entry) => entry.id), ...(options.game ?? [])]);
  for (const name of appDirs) {
    checked += 1;
    if (!games.has(name)) {
      report.problem({ file: shown(`apps/${name}`), rule: 'unknown-game-id', message: `app folder "${name}" is not a catalogue game id`, fix: 'Name the app after its catalogue game id (spec-lookup.mjs --list shows them), or pass --game <id> when the owner approved a new or renamed game.' });
    }
  }
  return report.finish({ checked, unit: 'files and app folders' });
});
