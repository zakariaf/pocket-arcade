#!/usr/bin/env node
// check-report.mjs: checks a message to the owner before it is sent. Evidence reports (slice or
// release): outcome first in plain words, at most one request with its default, an Evidence line,
// the Checks with numbers from reports/, what changed for players, at most five things to look at,
// and an honest "not verified" list. Requests (a stop-and-ask message): one plain sentence first,
// exactly one request with the default that applies until the owner answers. No placeholders left.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-report.mjs report.md [--kind slice|release|request]

import { readFileSync } from 'node:fs';

import { UsageError, createReporter, parseArgs, requireFile, run } from './check-lib.mjs';

const SPEC = {
  name: 'check-report',
  summary: 'Checks a message to the owner (an evidence report for a slice or release, or a stop-and-ask request) against the reporting rules.',
  usage: '[options] <report.md>',
  options: {
    kind: { type: 'string', value: 'slice|release|request', help: 'Which form to require (default: read from the Evidence line)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 1, max: 1 },
  details: [
    'Rules:',
    '  outcome-first          the first line is not one plain sentence about what changed for players',
    '  technical-detail-early a code fence, command, file path or stack trace before the Evidence line',
    '  too-many-requests      more than one request (a "Please ..." line or a question) to the owner',
    '  request-missing        a request message (--kind request) asks for nothing ("Please ..." line)',
    '  request-default        a request without the default that applies until the owner answers',
    '  evidence-line          no "Evidence: <game-id or area> <slice|release> on YYYY-MM-DD, commit <sha>" line',
    '  checks-missing         the Checks list lacks a line this form needs',
    '  tests-count            the Tests line has no <passed>/<total>, or not every test passed',
    '  report-source          a number line does not name the reports/ file it came from',
    '  section-missing        "What changed for players" or "Not tested or not verified" (and, for a release,',
    '                         "Goldens and baselines changed on purpose") is missing or empty',
    '  look-at-limit          "Please look at" lists more than 5 things',
    '  placeholder-left       a template placeholder such as <game-id>, <n> or __NAME__ is left',
    '  reference-change-id    a "Design references changed on purpose" line names no frame (s8-levels, s7-result-win',
    '                         --score, ...) or no change id from the reference manifest ("change L2", "change P-8")',
    '  waiver-trailer         a "Parity waivers changed" line names no waiver class (platform, platform-text-shaping,',
    '                         design-artefact) or no "Gate-Change trailer in <sha>"',
    '  copy-review            a "Texts changed in all four languages" line does not name en, de, fa and ckb, or does not',
    '                         say that fa and ckb wait for a native speaker\'s review',
    '',
    'The last three sections are optional: add each one when the work changed a design reference, a parity',
    'waiver or a player-visible text, and its rule applies to every line in it.',
    '',
    'Slice form: Checks need "Types, lint, format" and "Tests". Release form: also Coverage, Mutation, Bots,',
    'End-to-end, Network, Screenshots and Design match, each with its source file. A "Design match" line names',
    'the visual-parity sign-off ledger parity/signoff.json (or a reports/ or .parity/ file). Request form: outcome-first,',
    'too-many-requests, request-missing, request-default and placeholder-left only (an exact error line is',
    'welcome in a release stop).',
  ].join('\n'),
};

const RELEASE_CHECKS = ['Coverage', 'Mutation', 'Bots', 'End-to-end', 'Network', 'Screenshots', 'Design match'];
const SOURCED = ['Coverage', 'Mutation', 'Bots', 'End-to-end', 'Network', 'Screenshots', 'Design match'];
const HEADINGS = ['Checks', 'What changed for players', 'Please look at', 'Goldens and baselines changed on purpose', 'Design references changed on purpose', 'Parity waivers changed', 'Texts changed in all four languages', 'Not tested or not verified', 'Details'];
const FRAME_KEY = /\bs\d{1,2}[a-d]?-[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9-]+)?\b/;
const CHANGE_ID = /\bchanges?\s+(?:[A-Z]{1,4}-?\d+[a-z]?)(?:\s*(?:,|and)\s*[A-Z]{1,4}-?\d+[a-z]?)*\b/;
const WAIVER_CLASS = /\b(platform-text-shaping|platform|design-artefact)\b/;
const TRAILER_SHA = /Gate-Change trailer in [0-9a-f]{7,40}\b/;

/** The optional change sections: every line names what the owner needs to find the change again. */
function checkChangeSections(parts, add) {
  for (const item of parts.get('Design references changed on purpose')?.items ?? []) {
    if (!FRAME_KEY.test(item.text) || !CHANGE_ID.test(item.text)) add(item.line, 'reference-change-id', `"${item.text.slice(0, 60)}" does not name its frames and its change id`, 'Name the frames (s8-levels light-fa, s7-result-win--score) and the id of the change in the reference manifest\'s referenceChanges ("change L2"), then say in players\' words what changed and why.');
  }
  for (const item of parts.get('Parity waivers changed')?.items ?? []) {
    if (!WAIVER_CLASS.test(item.text) || !TRAILER_SHA.test(item.text)) add(item.line, 'waiver-trailer', `"${item.text.slice(0, 60)}" does not name the waiver class and its Gate-Change commit`, 'Say which frames and elements, the class (platform, platform-text-shaping or design-artefact), the cause in plain words, and "(Gate-Change trailer in <sha>)"; parity/waivers.json is a gated path.');
  }
  for (const item of parts.get('Texts changed in all four languages')?.items ?? []) {
    const languages = ['en', 'de', 'fa', 'ckb'].filter((code) => !new RegExp(`\\b${code}\\b`).test(item.text));
    if (languages.length > 0 || !/\bnative\b/i.test(item.text)) add(item.line, 'copy-review', `"${item.text.slice(0, 60)}" ${languages.length > 0 ? `does not name ${languages.join(', ')}` : 'does not say that fa and ckb wait for native review'}`, 'Give the key or place, the new en text, say that de, fa and ckb changed with it, and that fa and ckb wait for a native speaker\'s review (R3).');
  }
}

function headingOf(line) {
  const text = line.replace(/^#+\s*/, '').replace(/[:*]/g, '').trim();
  return HEADINGS.find((heading) => text.toLowerCase().startsWith(heading.toLowerCase())) ?? null;
}

function sections(lines) {
  const out = new Map();
  let current = null;
  lines.forEach((text, index) => {
    const heading = headingOf(text);
    if (heading && !/^\s*-/.test(text)) {
      current = { heading, line: index + 1, items: [] };
      out.set(heading, current);
    } else if (current && /^\s*[-*]\s+\S/.test(text)) current.items.push({ text: text.replace(/^\s*[-*]\s+/, ''), line: index + 1 });
  });
  return out;
}

function checkPlaceholders(lines, add) {
  lines.forEach((text, index) => {
    const placeholder = /<(?:game-id|n|x|sha|date|seed|score|passed|total|file|reason|summary[^>]*|one line[^>]*|honest list[^>]*|screenshot[^>]*|slice or release)>|__[A-Z][A-Z0-9_]*__/.exec(text);
    if (placeholder) add(index + 1, 'placeholder-left', `placeholder ${placeholder[0]} is left`, 'Fill in the real value from the report files.');
  });
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  if (options.kind && !['slice', 'release', 'request'].includes(options.kind)) throw new UsageError(`--kind must be slice, release or request, got "${options.kind}"`);
  const isRequest = options.kind === 'request';
  const file = requireFile(positionals[0], 'report');
  const shown = positionals[0];
  const lines = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const report = createReporter({ name: 'check-report', json: options.json });
  const add = (line, rule, message, fix) => report.problem({ file: shown, line, rule, message, fix });

  const evidenceIndex = lines.findIndex((line) => /^Evidence:/.test(line.trim()));
  const firstIndex = lines.findIndex((line) => line.trim() !== '');
  if (firstIndex === -1) throw new UsageError(`nothing to check: ${shown} is empty`, 'Write the report first (templates/evidence-slice.md).');
  const first = lines[firstIndex].trim();
  const sentences = first.split(/(?<=[.!])\s+(?=[A-Z])/).filter(Boolean);
  if (/^(Evidence:|#|-|\*|```|Checks|Details|Please)/.test(first) || !/[.!]$/.test(first) || sentences.length > 2 || first.length > 240) {
    const fix = isRequest ? 'Start with one plain sentence saying what is blocked or what happened ("The release of Flock Tilt stopped at the upload and I have not retried it.").' : 'Start with one plain sentence, in players\' words, saying what now works ("Line Siege now saves after every move: ...").';
    add(firstIndex + 1, 'outcome-first', `the message starts with "${first.slice(0, 60)}"`, fix);
  }
  const head = isRequest ? [] : lines.slice(0, evidenceIndex === -1 ? Math.min(lines.length, 6) : evidenceIndex);
  head.forEach((text, index) => {
    if (/```|^\s+at\s|\bError:|npm (ERR|error)|^\s*\$\s|`[^`]*[/.][^`]*`|\b[\w-]+\/[\w./-]+\.(ts|tsx|js|json|png|yaml)\b/.test(text)) {
      add(index + 1, 'technical-detail-early', `"${text.trim().slice(0, 60)}" is technical detail before the evidence`, 'Keep the first lines in plain words; commands, paths and stack traces go under a "Details" line at the end.');
    }
  });
  const requests = lines.map((text, index) => ({ text: text.trim(), line: index + 1 })).filter(({ text }) => (/^Please\b/.test(text) && !/^Please look at/i.test(text)) || (/\?\s*$/.test(text) && !/^[-*]/.test(text)));
  if (requests.length > 1) add(requests[1].line, 'too-many-requests', `${requests.length} requests to the owner`, 'Ask for one thing per message; put the rest in the next message once this one is answered.');
  for (const request of requests) {
    if (!/until then|meanwhile|default|in the meantime/i.test(request.text)) add(request.line, 'request-default', `"${request.text.slice(0, 60)}" gives no default`, 'Say what applies until the owner answers: "Until then I keep working on the board."');
  }
  if (isRequest) {
    if (requests.length === 0) add(firstIndex + 1, 'request-missing', 'the message asks the owner for nothing', 'Add one "Please <the one action> (step <ID>, about <n> minutes). Until then <the default>." line.');
    checkPlaceholders(lines, add);
    return report.finish({ checked: lines.length, unit: 'message lines' });
  }

  const evidence = evidenceIndex === -1 ? null : /^Evidence: (\S+) (.+?) on (\d{4}-\d{2}-\d{2}), commit ([0-9a-f]{7,40})\s*$/.exec(lines[evidenceIndex].trim());
  if (!evidence) add(evidenceIndex + 1, 'evidence-line', evidenceIndex === -1 ? 'no Evidence line' : `"${lines[evidenceIndex].trim().slice(0, 70)}" is not "Evidence: <game-id> <slice or release> on YYYY-MM-DD, commit <sha>"`, 'Add the Evidence line from the template with the real date and commit.');
  const kind = options.kind ?? (evidence && /\brelease\b/i.test(evidence[2]) ? 'release' : 'slice');

  const parts = sections(lines);
  const checks = parts.get('Checks');
  const needed = ['Types, lint, format', 'Tests', ...(kind === 'release' ? RELEASE_CHECKS : [])];
  if (!checks) add(0, 'checks-missing', 'no "Checks" list', 'Add the Checks list from the template.');
  else {
    for (const name of needed) {
      if (!checks.items.some((item) => item.text.toLowerCase().startsWith(name.toLowerCase()))) add(checks.line, 'checks-missing', `the Checks list has no "${name}" line`, `Add "- ${name}: ..." with the number from its report file.`);
    }
    for (const item of checks.items) {
      if (/^tests\b/i.test(item.text)) {
        const count = /(\d+)\s*\/\s*(\d+)/.exec(item.text);
        if (!count) add(item.line, 'tests-count', 'the Tests line has no <passed>/<total>', 'Write "Tests: 212/212 pass (unit 190, golden 22), random seed 1234" from the Jest output.');
        else if (count[1] !== count[2]) add(item.line, 'tests-count', `only ${count[1]} of ${count[2]} tests pass`, 'A slice is done only when every test passes; fix the failures first.');
      }
      const designLine = /^design match/i.test(item.text);
      const sourced = designLine ? /reports\/|parity\/signoff\.json|\.parity\//.test(item.text) : /reports\//.test(item.text);
      if (SOURCED.some((name) => item.text.toLowerCase().startsWith(name.toLowerCase())) && !sourced) add(item.line, 'report-source', `"${item.text.slice(0, 50)}" does not name its ${designLine ? 'sign-off ledger (parity/signoff.json)' : 'reports/ file'}`, designLine ? 'Name the visual-parity sign-off ledger the match is recorded in: "... parity/signoff.json".' : 'Take the number from its file under reports/ and name that file on the line.');
    }
  }
  const required = ['What changed for players', 'Not tested or not verified', ...(kind === 'release' ? ['Goldens and baselines changed on purpose'] : [])];
  for (const name of required) {
    const part = parts.get(name);
    if (!part || part.items.length === 0) add(part?.line ?? 0, 'section-missing', `"${name}" is ${part ? 'empty' : 'missing'}`, `Add "${name}" with at least one line (say "none" plainly when there is nothing).`);
  }
  checkChangeSections(parts, add);
  const look = parts.get('Please look at');
  if (look && look.items.length > 5) add(look.line, 'look-at-limit', `"Please look at" lists ${look.items.length} things`, 'Point at no more than five things, the most important first.');
  checkPlaceholders(lines, add);
  return report.finish({ checked: lines.length, unit: 'report lines' });
});
