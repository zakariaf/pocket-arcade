#!/usr/bin/env node
// check-signoff.mjs: the definition of done for screen parity. A frame is done only when every
// required theme x language run passes check-parity against the current references, covers every
// element (tall frames: across scroll captures), has a fresh sheet, and has a sign-off ledger entry
// recording that Claude looked at exactly that sheet and found nothing open.
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { createReporter, fail, parseArgs, run, sha256 } from './check-lib.mjs';
import { FACTS_FILE, REQUIRED_LANGS, THEMES, describeFacts, describeReference, listOption, loadCatalogue, readGameFacts, referenceName, variantFor } from './lib/frames.mjs';
import { isCropOnly } from './lib/gates.mjs';
import { DEFAULTS } from './lib/paths.mjs';
import { changesForFrame } from './lib/reference-changes.mjs';
import { RUN_FILES, findRunDirs, readRun, readWaivers } from './lib/runs.mjs';

export const EYE_CHECKS = ['icons', 'pictures', 'shadows', 'alignment', 'wrapping', 'direction', 'feel'];

const SPEC = {
  name: 'check-signoff',
  summary:
    'Proves screen parity is done: for each frame and each required theme x language (light and dark x en and fa, the ' +
    'done set), the latest run passes check-parity against the reference the game facts select, every element was ' +
    'checked (tall frames: across every planned scroll offset), the sheet is fresh, and parity/signoff.json has an entry ' +
    'for exactly that sheet with every eye check answered and no open difference. --themes and --langs narrowing is for ' +
    'iteration only: a narrowed run prints "narrowed: not a sign-off" and exits 1. --draft <run-dir> prints a ledger ' +
    'entry to fill in.',
  usage: '(--frame <key>... | --screen <S4>... | --all) [options] | --draft <run-dir> [--from-ledger] [--date YYYY-MM-DD]',
  options: {
    frame: { type: 'string', multiple: true, value: 'key', help: 'Frame key(s) to sign off (s4-home, s4-home-premium, ...)' },
    screen: { type: 'string', multiple: true, value: 'id', help: 'Screen id(s): every frame of the screen (S4 = s4-home + s4-home-premium)' },
    all: { type: 'boolean', help: 'Every frame of the design' },
    game: { type: 'string', value: 'id', help: 'Design game id', default: 'lineSiege' },
    themes: { type: 'string', value: 'list', help: 'Themes required (default light,dark: the done set; fewer is iteration only and fails "narrowed")', default: THEMES.join(',') },
    langs: { type: 'string', value: 'list', help: 'Languages required (default en,fa: the done set; add de,ckb before a release; fewer fails "narrowed")', default: REQUIRED_LANGS.join(',') },
    runs: { type: 'string', value: 'dir', help: 'Run folder root', default: '.parity' },
    ledger: { type: 'string', value: 'file', help: 'Sign-off ledger', default: 'parity/signoff.json' },
    waivers: { type: 'string', value: 'file', help: 'Waiver file', default: 'parity/waivers.json' },
    reference: { type: 'string', value: 'dir', help: 'Reference root (default: the committed set)' },
    draft: { type: 'string', value: 'run-dir', help: 'Print a ledger entry skeleton for this run (after make-sheet.mjs) and exit' },
    'from-ledger': { type: 'boolean', help: 'With --draft: copy the recorded differences of the previous entry for the same frame and variant (eye checks stay open)' },
    date: { type: 'string', value: 'YYYY-MM-DD', help: "With --draft: the entry's date (default: today's local calendar day, the product's own 'today' rule, never the UTC day)" },
    map: { type: 'string', value: 'file', help: 'Screen testID map', default: DEFAULTS.map },
    frames: { type: 'string', value: 'file', help: 'Frames manifest', default: DEFAULTS.frames },
    facts: { type: 'string', value: 'file', help: "The app's game facts: the reference variant each frame must use", default: FACTS_FILE },
    app: { type: 'string', value: 'id', help: 'App id in the facts file (needed when it lists several apps)' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    `Eye checks (each "match", "n/a", or "waived: <reason of 20+ characters>"): ${EYE_CHECKS.join(', ')}.`,
    'A difference is { "what": "...", "status": "fixed" | "waived" } once handled; "open" blocks sign-off.',
    '',
    'The done set: a frame is signed off in light and dark x en and fa, at every scroll offset run-parity.mjs plans,',
    'against the reference its game\'s facts pick; de and ckb are added before a release. --themes and --langs may',
    'narrow the check while fixing, but such a run is never a sign-off.',
    '',
    'Examples:',
    '  node check-signoff.mjs --screen S4',
    '  node check-signoff.mjs --draft .parity/lineSiege/s4-home/dark-fa',
    '  node check-signoff.mjs --draft .parity/lineSiege/s4-home/dark-fa --from-ledger   (after a rebuild: keep the differences)',
    '',
    'A draft is dated with the local calendar day of the Mac (at 01:17 in Berlin on 1 October it is 2026-10-01, not',
    "the UTC day 2026-09-30), the same day the waivers' reportedToOwner and the reports use; --date YYYY-MM-DD sets it.",
    '',
    'Waivers are listed per frame with their class (platform, platform-text-shaping, design-artefact); every one of them',
    'goes into the report to the owner. So are the intended reference changes (the reference manifest\'s',
    'referenceChanges) of every frame signed off, and the reference each frame used: a frame with variants uses the one',
    "the app's game facts (parity/game-facts.json) select.",
  ].join('\n'),
};

/** The local calendar day of a moment as YYYY-MM-DD (the product's "today": local time, never UTC). */
function localDay(moment = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`;
}

/** --date: a real calendar day written YYYY-MM-DD, else exit 2. */
function draftDate(value) {
  if (value === undefined) return localDay();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const day = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  if (!day || localDay(day) !== value) fail(`--date ${value} is not a calendar day written YYYY-MM-DD`, 'Pass the day of the look, for example --date 2026-10-01, or leave --date out for today (local time).');
  return value;
}

function readLedger(path) {
  if (!existsSync(path)) return { entries: [], problems: [] };
  try {
    const json = JSON.parse(readFileSync(path, 'utf8'));
    if (json.version !== 1 || !Array.isArray(json.entries)) return { entries: [], problems: ['expected { "version": 1, "entries": [...] }'] };
    return { entries: json.entries, problems: [] };
  } catch (error) {
    return { entries: [], problems: [`not valid JSON: ${error.message}`] };
  }
}

/**
 * --draft: the ledger entry skeleton for one run, for exactly its current sheets. With --from-ledger
 * the previous entry for the same game, frame, theme, language and scroll offset lends its recorded
 * differences (a rebuild that only changed the sheet hash keeps them); the eye checks always start
 * open, because the new sheet has to be looked at again.
 */
function draftEntry(options, show) {
  const date = draftDate(options.date);
  const dir = resolve(options.draft);
  const r = readRun(dir);
  const report = createReporter({ name: 'check-signoff' });
  const sheetsPath = join(dir, 'sheets.json');
  const reportPath = join(dir, RUN_FILES.report);
  if (!existsSync(sheetsPath)) fail(`${show(dir)} has no sheets.json`, 'Run check-parity.mjs and make-sheet.mjs on it first.');
  const sheets = JSON.parse(readFileSync(sheetsPath, 'utf8'));
  // A draft is only worth writing for sheets that belong to the latest check and still exist.
  if (!existsSync(reportPath) || sheets.reportSha256 !== sha256(readFileSync(reportPath))) {
    report.problem({ file: show(sheetsPath), rule: 'stale-sheet', message: `${show(dir)}: the sheets were made before the latest check`, fix: 'Run make-sheet.mjs again, look at the new sheets, then draft.' });
  }
  const changed = Object.entries(sheets.files ?? {}).filter(([name, hash]) => !existsSync(join(dir, name)) || sha256(readFileSync(join(dir, name))) !== hash).map(([name]) => name);
  if (changed.length) report.problem({ file: show(sheetsPath), rule: 'stale-sheet', message: `${show(dir)}: ${changed.slice(0, 3).join(', ')} missing or changed since make-sheet.mjs wrote them`, fix: 'Run make-sheet.mjs again, look at the new sheets, then draft.' });
  const entry = {
    game: r.info.game,
    frame: r.info.frame,
    theme: r.info.theme,
    lang: r.info.lang,
    scrollY: r.info.scrollY,
    sheetSha256: sheets.files?.['sheet.png'],
    date,
    looked: Object.keys(sheets.files ?? {}).filter((f) => !f.startsWith('crops/')),
    eyeChecks: Object.fromEntries(EYE_CHECKS.map((k) => [k, 'open'])),
    differences: [],
  };
  if (options['from-ledger']) {
    const ledgerPath = resolve(options.ledger);
    const ledger = readLedger(ledgerPath);
    for (const message of ledger.problems) report.problem({ file: show(ledgerPath), rule: 'ledger-invalid', message, fix: 'Start from the skill\'s templates/parity/signoff.json.' });
    const previous = ledger.entries.find((e) => e.frame === entry.frame && e.theme === entry.theme && e.lang === entry.lang && (e.game ?? 'lineSiege') === entry.game && (e.scrollY ?? 0) === entry.scrollY);
    if (previous) {
      entry.differences = (previous.differences ?? []).map((d) => ({ ...d }));
      report.note(`copied ${entry.differences.length} recorded difference${entry.differences.length === 1 ? '' : 's'} from the entry of ${previous.date ?? '?'} (sheet ${String(previous.sheetSha256 ?? '?').slice(0, 8)}); every eye check is open again`);
    } else if (!ledger.problems.length) {
      report.note(`no earlier entry for ${entry.frame} ${entry.theme}-${entry.lang}${entry.scrollY ? ` y${entry.scrollY}` : ''} in ${show(ledgerPath)}: nothing copied`);
    }
  }
  if (report.count === 0) {
    console.log(JSON.stringify(entry, null, 1));
    report.note('Read every file in "looked", answer each eye check, check each copied difference is still true, list what else differs, then put the entry in the ledger (replacing the old one).');
  }
  return report.finish({ checked: 1, unit: 'runs' });
}

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const show = (p) => relative(process.cwd(), p) || '.';
  if (options.draft) return draftEntry(options, show);
  if (options.date !== undefined) fail('--date belongs to --draft', 'Use it as: node check-signoff.mjs --draft <run-dir> --date YYYY-MM-DD');
  const { frames } = loadCatalogue({ mapPath: resolve(options.map), framesPath: resolve(options.frames) });
  let keys = listOption(options.frame, []);
  for (const id of listOption(options.screen, [])) {
    const matching = [...frames.values()].filter((f) => f.entries.some((e) => e.screen.toLowerCase() === id.toLowerCase())).map((f) => f.key);
    if (!matching.length) fail(`no frames for screen "${id}"`, 'Use a screen id such as S4 or S11a.');
    keys.push(...matching);
  }
  if (options.all) keys = [...frames.keys()];
  keys = [...new Set(keys)];
  if (!keys.length) fail('nothing to sign off: pass --frame, --screen or --all', 'Run: node check-signoff.mjs --help');
  for (const k of keys) if (!frames.has(k)) fail(`unknown frame "${k}"`, `Use one of: ${[...frames.keys()].join(', ')}`);
  const themes = listOption(options.themes, THEMES);
  const langs = listOption(options.langs, REQUIRED_LANGS);
  const narrowed = !THEMES.every((t) => themes.includes(t)) || !REQUIRED_LANGS.every((l) => langs.includes(l));
  const runsRoot = resolve(options.runs);
  const ledgerPath = resolve(options.ledger);
  const ledger = readLedger(ledgerPath);
  const waiverFile = readWaivers(resolve(options.waivers));
  const report = createReporter({ name: 'check-signoff' });
  for (const message of ledger.problems) report.problem({ file: show(ledgerPath), rule: 'ledger-invalid', message, fix: 'Start from the skill\'s templates/parity/signoff.json.' });
  for (const p of waiverFile.problems) report.problem({ file: show(waiverFile.path), ...p });
  const table = [];
  let checked = 0;
  const needsFacts = keys.some((k) => Object.keys(frames.get(k).variants ?? {}).length > 0 && frames.get(k).kind !== 'mock-only');
  const facts = needsFacts ? readGameFacts(resolve(options.facts), { app: options.app ?? null, game: options.game }) : null;
  const refManifestPath = join(resolve(options.reference ?? DEFAULTS.reference), options.game, 'manifest.json');
  const refManifest = existsSync(refManifestPath) ? JSON.parse(readFileSync(refManifestPath, 'utf8')) : null;
  const changeNotes = [];
  for (const key of keys) {
    const frame = frames.get(key);
    if (frame.kind === 'mock-only') {
      table.push(`${key.padEnd(32)} mock-only (look at the reference; nothing to sign)`);
      continue;
    }
    const variant = facts ? variantFor(frame, facts.facts) : null;
    const wantedName = referenceName(key, variant?.id);
    changeNotes.push(`reference ${describeReference(key, variant)}`);
    for (const c of changesForFrame(refManifest, key).filter((entry) => (entry.frames ?? []).includes(key) || (entry.variants ?? []).includes(wantedName))) {
      changeNotes.push(`  intended reference change ${c.id} (${c.date}): ${c.what} Why: ${c.why}`);
    }
    const cells = [];
    for (const theme of themes) {
      for (const lang of langs) {
        checked += 1;
        const tag = `${theme}-${lang}`;
        const where = `${key} ${tag}`;
        const frameRoot = join(runsRoot, options.game, key);
        const dirs = existsSync(frameRoot) ? findRunDirs(frameRoot).filter((d) => {
          const name = d.split(/[\\/]/).pop();
          return name === tag || name.startsWith(`${tag}-y`);
        }) : [];
        const problem = (rule, message, fix) => report.problem({ file: show(dirs[0] ?? join(frameRoot, tag)), rule, message: `${where}: ${message}`, fix });
        if (!dirs.length) {
          problem('not-captured', 'no run folder', `Capture it: node capture-app.mjs --frame ${key} --theme ${theme} --lang ${lang} --bundle-id <id>`);
          cells.push(`${tag} missing`);
          continue;
        }
        let ok = true;
        const coverage = new Set();
        const offscreen = new Set();
        let layout = null;
        for (const dir of dirs) {
          const r = readRun(dir, { referenceRoot: options.reference });
          const reportPath = join(dir, RUN_FILES.report);
          if (r.reference.name !== wantedName) {
            problem('reference-variant', `${show(dir)} was captured against ${r.reference.name}, but the game facts select ${wantedName}`, `Capture again with run-parity.mjs (it reads ${show(resolve(options.facts))}).`);
            ok = false;
            continue;
          }
          if (!existsSync(reportPath)) {
            problem('not-checked', `${show(dir)} has no report.json`, 'Run check-parity.mjs on it.');
            ok = false;
            continue;
          }
          const rep = JSON.parse(readFileSync(reportPath, 'utf8'));
          // Only a real simulator capture counts: not a design-as-app run, not a borrowed image.
          const appSha = existsSync(r.app) ? sha256(readFileSync(r.app)) : null;
          if (r.info.source === 'design-as-app' || !r.info.bundleId || typeof r.info.app === 'string') {
            problem('not-a-capture', `${show(dir)} was not written by capture-app.mjs (source ${r.info.source ?? 'unknown'}${typeof r.info.app === 'string' ? `, app image ${r.info.app}` : ''})`, `Capture the app itself: node capture-app.mjs --frame ${key} --theme ${theme} --lang ${lang} --bundle-id <id>`);
            ok = false;
          } else if (appSha && existsSync(r.reference.image) && appSha === sha256(readFileSync(r.reference.image))) {
            problem('not-a-capture', `${show(dir)}/app.png is the design reference itself`, 'Capture the app on the simulator; never copy the reference in.');
            ok = false;
          }
          if (!existsSync(r.reference.image) || rep.reference?.imageSha256 !== sha256(readFileSync(r.reference.image)) || rep.reference?.layoutSha256 !== sha256(readFileSync(r.reference.layout))) {
            problem('stale-report', `${show(dir)} was checked against a different reference than the current one`, 'Run check-parity.mjs again (the references changed).');
            ok = false;
          }
          if (!appSha || rep.app?.imageSha256 !== appSha) {
            problem('stale-report', `${show(dir)}/report.json does not belong to its app.png`, 'Run check-parity.mjs again after every capture.');
            ok = false;
          }
          if (rep.result !== 'PASS') {
            problem('not-passing', `${show(dir)} has ${rep.problems?.length ?? '?'} parity problems (first: ${rep.problems?.[0]?.message ?? 'see report.json'})`, 'Fix the app, rebuild, capture and check again.');
            ok = false;
          }
          for (const w of rep.waived ?? []) {
            if (!waiverFile.waivers.some((x) => x.index === w.waiver.index && x.reason === w.waiver.reason)) {
              problem('waiver-gone', `${show(dir)} relied on waiver ${w.waiver.index}, which is no longer in the waiver file`, 'Run check-parity.mjs again.');
              ok = false;
            }
          }
          for (const id of rep.coverage ?? []) coverage.add(id);
          for (const id of rep.offscreen ?? []) offscreen.add(id);
          layout = layout ?? (existsSync(r.reference.layout) ? JSON.parse(readFileSync(r.reference.layout, 'utf8')) : null);
          // The look: a fresh sheet and a ledger entry for exactly that sheet.
          const sheetsPath = join(dir, 'sheets.json');
          if (!existsSync(sheetsPath)) {
            problem('no-sheet', `${show(dir)} has no sheets (make-sheet.mjs not run)`, 'Run make-sheet.mjs on it and read the images.');
            ok = false;
            continue;
          }
          const sheets = JSON.parse(readFileSync(sheetsPath, 'utf8'));
          if (sheets.reportSha256 !== sha256(readFileSync(reportPath))) {
            problem('stale-sheet', `${show(dir)}: the sheets were made before the latest check`, 'Run make-sheet.mjs again and look again.');
            ok = false;
            continue;
          }
          const changed = Object.entries(sheets.files ?? {}).filter(([name, hash]) => !existsSync(join(dir, name)) || sha256(readFileSync(join(dir, name))) !== hash).map(([name]) => name);
          if (changed.length || !sheets.files?.['sheet.png']) {
            problem('stale-sheet', `${show(dir)}: ${changed.length ? `${changed.slice(0, 3).join(', ')} ${changed.length > 1 ? 'are' : 'is'} missing or changed since make-sheet.mjs wrote ${changed.length > 1 ? 'them' : 'it'}` : 'sheets.json lists no sheet.png'}`, 'Run make-sheet.mjs again and look again.');
            ok = false;
            continue;
          }
          const entry = ledger.entries.find((e) => e.frame === key && e.theme === theme && e.lang === lang && (e.game ?? 'lineSiege') === options.game && (e.scrollY ?? 0) === r.info.scrollY);
          if (!entry) {
            problem('not-looked', `${show(dir)}: no sign-off entry in ${show(ledgerPath)}`, `Read the sheets, then add the entry: node check-signoff.mjs --draft ${show(dir)}`);
            ok = false;
            continue;
          }
          if (entry.sheetSha256 !== sheets.files['sheet.png']) {
            problem('looked-at-old-sheet', `${show(dir)}: the ledger entry is for another sheet (the app or the reference changed since the look)`, 'Look at the new sheet and update sheetSha256, the eye checks and the differences.');
            ok = false;
          }
          const mustLook = Object.keys(sheets.files).filter((f) => !f.startsWith('crops/'));
          const unseen = mustLook.filter((f) => !(entry.looked ?? []).includes(f));
          if (unseen.length) {
            problem('not-looked', `${show(dir)}: the entry does not list ${unseen.join(', ')} as looked at`, 'Read every sheet image (sheet, zoom bands, eye pages) and list them in "looked".');
            ok = false;
          }
          for (const k of EYE_CHECKS) {
            const v = entry.eyeChecks?.[k];
            const valid = v === 'match' || v === 'n/a' || (typeof v === 'string' && /^waived: .{20,}/.test(v));
            if (!valid) {
              problem('eye-check-open', `${show(dir)}: eye check "${k}" is ${v === undefined ? 'missing' : `"${v}"`}`, 'Compare that aspect on the sheets and answer "match", "n/a" or "waived: <reason>" (waived only for a platform limit, reported to the owner).');
              ok = false;
            }
          }
          for (const d of entry.differences ?? []) {
            if (!['fixed', 'waived'].includes(d?.status)) {
              problem('difference-open', `${show(dir)}: open difference "${d?.what ?? '?'}"`, 'Fix it (then capture, check, sheet and look again) or record why it is a platform limit.');
              ok = false;
            }
          }
        }
        if (layout && frame.kind === 'phone-tall') {
          // Crop-only parts (parent, a11yHidden) are covered with the element whose crop holds them.
          const needed = layout.elements.filter((el) => el.count === 1 && el.rect && !isCropOnly(el)).map((el) => el.testID);
          const never = needed.filter((id) => !coverage.has(id));
          if (never.length) {
            problem('coverage', `${never.length} elements were never fully on screen in any capture (${never.slice(0, 4).join(', ')}${never.length > 4 ? ', ...' : ''})`, `Capture the scroll offsets run-parity.mjs plans for this frame (each body element whole between the top bar and the end of the body at least once), or add one with capture-app.mjs --frame ${key} --scroll <pt>, then check it.`);
            ok = false;
          }
        }
        cells.push(`${tag} ${ok ? 'done' : 'open'}${dirs.length > 1 ? ` (${dirs.length} captures)` : ''}`);
      }
    }
    table.push(`${key.padEnd(32)} ${cells.join(' | ')}`);
  }
  if (facts) report.note(`facts ${show(facts.path)}: app ${facts.app}, ${describeFacts(facts.facts)}`);
  if (narrowed) {
    report.problem({
      file: show(ledgerPath),
      rule: 'narrowed',
      message: `narrowed: not a sign-off (checked ${themes.join(', ')} x ${langs.join(', ')}; the done set is light and dark x en and fa at every planned offset)`,
      fix: 'Drop --themes and --langs (narrowing is for iteration only), capture the missing variants with run-parity.mjs, look at their sheets and record them.',
    });
  }
  for (const line of changeNotes) report.note(line);
  for (const line of table) report.note(line);
  for (const w of waiverFile.waivers.filter((x) => keys.includes(x.frame))) {
    report.note(`waiver ${w.index} [${w.class}] ${w.frame} ${w.testID} ${w.rule}${w.langs ? ` (${w.langs.join(', ')})` : ''}: ${w.class === 'design-artefact' ? `mockup CSS ${w.designCause}` : w.class === 'platform-text-shaping' ? `glyphs ${w.glyphs}` : 'platform limit'}; owner told ${w.reportedToOwner}`);
  }
  return report.finish({ checked, unit: 'frame variants' });
});
