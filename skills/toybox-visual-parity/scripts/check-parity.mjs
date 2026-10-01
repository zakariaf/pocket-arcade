#!/usr/bin/env node
// check-parity.mjs: the per-element parity gates between a design reference and an app capture.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { createReporter, fail, parseArgs, run, sha256 } from './check-lib.mjs';
import { TOOLING_OPTION, loadImageDeps, toolingDirOf } from './lib/deps.mjs';
import { FACTS_FILE, describeFacts, describeReference, loadCatalogue, readGameFacts, referenceName, variantFor, withMapMetadata, withModal } from './lib/frames.mjs';
import { TOLERANCES, compareRun } from './lib/gates.mjs';
import { parseAppLayout, parseMaestroHierarchy } from './lib/hierarchy.mjs';
import { DEFAULTS, readJson } from './lib/paths.mjs';
import { readPng } from './lib/png.mjs';
import { RUN_FILES, applyWaivers, findRunDirs, prelistedWaiverFor, readRun, readWaivers } from './lib/runs.mjs';

const SPEC = {
  name: 'check-parity',
  summary:
    'Compares app captures with their Toybox design references, element by element (keyed by testID): ' +
    `the screen is reached, every element is there, bounds within +-${TOLERANCES.boundsPt} pt, exact text, fill colour ` +
    `within ${TOLERANCES.fillChannelDelta}/255, text ink (measured in the text colour) within +-${TOLERANCES.inkSizePt} pt size and +-${TOLERANCES.inkCentrePt} pt centre, or the type role's measured floor + ${TOLERANCES.layoutNoisePt} pt where larger, ` +
    `and no shape difference at least ${TOLERANCES.blobThicknessPt} pt thick in any aligned element crop. The status bar and ` +
    'home indicator are masked. Writes report.json into each run folder.',
  usage: '<run-dir>... | --runs <folder> [options]',
  options: {
    runs: { type: 'string', value: 'folder', help: 'Check every run folder (holding run.json) under this folder' },
    reference: { type: 'string', value: 'dir', help: 'Reference root (default: the committed set in assets/reference/; a run.json may name its own)' },
    waivers: { type: 'string', value: 'file', help: 'Waiver file', default: 'parity/waivers.json' },
    device: { type: 'string', value: 'file', help: 'Device profile', default: DEFAULTS.device },
    map: { type: 'string', value: 'file', help: 'Screen testID map (element metadata: checks, parts, masks)', default: DEFAULTS.map },
    frames: { type: 'string', value: 'file', help: 'Frames manifest', default: DEFAULTS.frames },
    'no-write': { type: 'boolean', help: 'Do not write report.json' },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
    facts: { type: 'string', value: 'file', help: "The app's game facts: the reference variant a run must have used", default: FACTS_FILE },
    app: { type: 'string', value: 'id', help: 'App id in the facts file (needed when it lists several apps)' },
    tooling: TOOLING_OPTION,
  },
  positionals: { min: 0, max: Infinity },
  details: [
    'There is no option to change a tolerance, on purpose: every number is a measured noise floor.',
    'A problem that the platform truly cannot fix, or that the mockup CSS itself draws, goes into parity/waivers.json with its',
    'class (platform, platform-text-shaping, design-artefact; see the skill).',
    '',
    'Fix failures in the order printed: screen-not-reached, scroll-mismatch, missing, bounds, text, fill, border,',
    'text-ink, structure.',
    '',
    'A frame with reference variants is checked against the variant the app\'s game facts (parity/game-facts.json)',
    'select; a run captured against another reference fails reference-variant. A Game-route frame (s6-pause, s7-*)',
    'masks the board rectangle its run.json holds (capture-app\'s probe=board); a run without one stops with exit 2.',
    'Then run make-sheet.mjs on the same run folder and look at the sheet.',
    '',
    'Examples:',
    '  node check-parity.mjs .parity/lineSiege/s4-home/light-en',
    '  node check-parity.mjs --runs .parity/lineSiege/s4-home',
  ].join('\n'),
};

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const dirs = [...positionals.map((p) => resolve(p))];
  if (options.runs) {
    const root = resolve(options.runs);
    if (!existsSync(root)) fail(`run folder root not found: ${root}`, 'Capture first (capture-app.mjs), or pass the right folder.');
    dirs.push(...findRunDirs(root));
  }
  if (dirs.length === 0) fail('nothing to check: pass run folders or --runs <folder>', 'Run: node check-parity.mjs --help');
  const device = readJson(resolve(options.device), 'device profile');
  const { PNG, pixelmatch } = await loadImageDeps(toolingDirOf(options));
  const report = createReporter({ name: 'check-parity', json: options.json });
  const show = (p) => relative(process.cwd(), p) || '.';
  const catalogue = loadCatalogue({ mapPath: resolve(options.map), framesPath: resolve(options.frames) });
  const waiverFile = readWaivers(resolve(options.waivers));
  for (const p of waiverFile.problems) report.problem({ file: show(waiverFile.path), ...p });
  let runs = 0;
  let passed = 0;
  let facts;
  const factsFor = () => {
    facts ??= readGameFacts(resolve(options.facts), { app: options.app ?? null });
    return facts;
  };
  for (const dir of dirs) {
    const runInfo = readRun(dir, { referenceRoot: options.reference });
    const { info } = runInfo;
    const file = show(runInfo.app);
    const frame = catalogue.frames.get(info.frame);
    // The reference a frame with variants must be compared with comes from the app's facts.
    if (frame && Object.keys(frame.variants ?? {}).length > 0) {
      const f = factsFor();
      const wanted = variantFor(frame, f.facts);
      if ((wanted?.id ?? null) !== info.variant) {
        report.problem({ file, rule: 'reference-variant', message: `captured against ${referenceName(info.frame, info.variant)}, but the facts of app ${f.app} (${describeFacts(f.facts)}) select ${describeReference(info.frame, wanted)}`, fix: `Capture again (capture-app.mjs reads parity/game-facts.json), or fix the facts file if it is wrong for this game.` });
        continue;
      }
    }
    if (frame?.board && !(info.board?.rect && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(info.board.rect[k])))) {
      fail(`${show(dir)}/run.json has no board rectangle, but ${info.frame} is a Game-route frame whose board is masked`, `Capture it with capture-app.mjs, which launches the app once with probe=board and records "board" in run.json.`);
    }
    const refLayoutPath = runInfo.reference.layout;
    if (!existsSync(refLayoutPath) || !existsSync(runInfo.reference.image)) {
      report.problem({ file, rule: 'reference-missing', message: `no design reference for ${info.game} ${info.frame} ${info.theme}-${info.lang} (${show(refLayoutPath)})`, fix: `Render it: node shoot-design.mjs --out .parity/design --game ${info.game} --frame ${info.frame} --theme ${info.theme} --lang ${info.lang}, then pass --reference .parity/design.` });
      continue;
    }
    // Measurements come from the reference; element metadata (checks, parts, masks) from the current map.
    const layout = withModal(withMapMetadata(JSON.parse(readFileSync(refLayoutPath, 'utf8')), catalogue.frames.get(info.frame)), catalogue.frames.get(info.frame));
    if (layout.kind === 'mock-only') {
      report.note(`skip  ${show(dir)}: ${info.frame} is mock-only (Google draws it); look at the reference instead`);
      continue;
    }
    if (layout.frame !== info.frame || layout.theme !== info.theme || layout.lang !== info.lang) {
      report.problem({ file, rule: 'reference-mismatch', message: `run.json says ${info.frame} ${info.theme}-${info.lang} but the reference is ${layout.frame} ${layout.theme}-${layout.lang}`, fix: 'Fix run.json or the reference paths.' });
      continue;
    }
    if (!runInfo.hier && !runInfo.appLayout) {
      report.problem({ file, rule: 'bounds-missing', message: `the run has neither ${RUN_FILES.hier} nor ${RUN_FILES.layout}`, fix: 'Re-capture with capture-app.mjs (it dumps maestro hierarchy), or write the in-app layout report.' });
      continue;
    }
    const designImg = readPng(PNG, runInfo.reference.image, 'design reference');
    const appImg = readPng(PNG, runInfo.app, 'app capture');
    const boundsPath = runInfo.appLayout ?? runInfo.hier;
    const boundsJson = readJson(boundsPath, 'app bounds');
    const bounds = runInfo.appLayout ? parseAppLayout(boundsJson) : parseMaestroHierarchy(boundsJson);
    const board = frame?.board ? { ...frame.board, rect: info.board.rect, source: info.board.source } : null;
    const result = compareRun({ design: { img: designImg, layout }, app: { img: appImg, bounds }, device, pixelmatch, scrollY: info.scrollY, board, reachedBy: frame?.modal?.reachedBy ?? null, boardMask: frame?.boardMask ?? null });
    const { kept, waived, unused } = applyWaivers(result.problems, waiverFile.waivers, info);
    runs += 1;
    const c = result.checked;
    report.note(`run   ${show(dir)}: ${info.frame} (${layout.kind}) ${info.theme}-${info.lang} ${info.game}${info.scrollY ? ` scrollY ${info.scrollY}` : ''} [${bounds.source}]`);
    report.note(`      reference ${runInfo.reference.name}${info.variant ? ` (variant ${info.variant}, chosen by the game facts)` : ''}`);
    report.note(`      checked: bounds ${c.bounds}, text ${c.text}, fill ${c.fill}, border ${c.border}, text-ink ${c['text-ink']}, structure ${c.structure}${result.stats.pixelDiffPercent !== undefined ? `; whole-screen pixel diff ${result.stats.pixelDiffPercent} % (report only, never a gate)` : ''}`);
    if (result.offscreen.length) report.note(`      off-screen in this capture (capture another scroll position): ${result.offscreen.length} elements, first ${result.offscreen.slice(0, 5).join(', ')}`);
    for (const n of result.notes.slice(0, 12)) report.note(`      note  ${n}`);
    if (result.notes.length > 12) report.note(`      note  ... ${result.notes.length - 12} more in report.json`);
    for (const w of waived) report.note(`      WAIVED [${w.rule}] ${w.message} (waiver ${w.waiver.index}, ${w.waiver.class}: ${w.waiver.reason}; owner told ${w.waiver.reportedToOwner})`);
    for (const w of unused) report.note(`      note  waiver ${w.index} (${w.testID} ${w.rule}) matched nothing here: delete it if the problem is gone everywhere`);
    for (const p of kept) {
      // A few problems are known platform limits or mockup artefacts with a pre-listed waiver.
      const pre = prelistedWaiverFor(p, info);
      report.problem({ file, rule: p.rule, message: p.message, fix: pre ? `${p.fix} This element has a pre-listed ${pre.class} waiver (${pre.cause}): when its crop shows only that, copy the entry from the skill's templates/parity/waivers.json into parity/waivers.json (signoff-and-waivers.md, "Pre-listed waivers").` : p.fix });
    }
    if (kept.length === 0) passed += 1;
    if (!options['no-write']) {
      const reportJson = {
        version: 1,
        result: kept.length === 0 ? 'PASS' : 'FAIL',
        frame: info.frame,
        kind: layout.kind,
        theme: info.theme,
        lang: info.lang,
        game: info.game,
        scrollY: info.scrollY,
        boundsSource: bounds.source,
        createdAt: new Date().toISOString(),
        tolerances: TOLERANCES,
        reference: { image: relative(dir, runInfo.reference.image), imageSha256: sha256(readFileSync(runInfo.reference.image)), layoutSha256: sha256(readFileSync(refLayoutPath)) },
        app: { imageSha256: sha256(readFileSync(runInfo.app)), boundsSha256: sha256(readFileSync(boundsPath)) },
        checked: result.checked,
        coverage: result.coverage,
        offscreen: result.offscreen,
        stats: result.stats,
        problems: kept,
        waived,
        notes: result.notes,
      };
      writeFileSync(resolve(dir, RUN_FILES.report), `${JSON.stringify(reportJson, null, 1)}\n`);
    }
  }
  if (runs > 0) report.note(`${passed} of ${runs} runs pass${runs > passed ? '; fix the first rule listed for each failing run, rebuild, re-capture, re-check' : '; now run make-sheet.mjs and look'}`);
  return report.finish({ checked: runs, unit: 'runs' });
});
