#!/usr/bin/env node
// run-parity.mjs: the whole machine side of the parity loop for one or more design frames, in every
// required theme x language (and at every scroll offset of a tall frame): capture-app.mjs, then
// check-parity.mjs, then make-sheet.mjs, with one summary table and the list of sheets to look at.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { createReporter, fail, makeTempDir, parseArgs, removeTempDir, run } from './check-lib.mjs';
import { FACTS_FILE, REQUIRED_LANGS, THEMES, describeReference, listOption, loadCatalogue, readGameFacts, referenceName, variantFor } from './lib/frames.mjs';
import { scrollPlan } from './lib/gates.mjs';
import { DEFAULTS, SCRIPTS_DIR, readJson } from './lib/paths.mjs';
import { RUN_FILES, defaultRunDir, runDirName } from './lib/runs.mjs';

const SPEC = {
  name: 'run-parity',
  summary:
    'Runs the parity loop for design frames (--frame, or every frame of --screen): for each theme x language ' +
    '(default light, dark x en, fa) and each scroll offset of a tall frame it captures the app (capture-app.mjs), ' +
    'checks it (check-parity.mjs) and draws the look-pass sheets (make-sheet.mjs). Prints one line per run and the ' +
    'sheets to read. --recheck skips the capture and re-checks the runs already in --root.',
  usage: '(--frame <key>... | --screen <id>...) --bundle-id <id> [options]',
  options: {
    frame: { type: 'string', multiple: true, value: 'key', help: 'Design frame key(s), e.g. s4-home' },
    screen: { type: 'string', multiple: true, value: 'id', help: 'Screen id(s): every frame of the screen (S12 = 9 frames)' },
    'bundle-id': { type: 'string', value: 'id', help: "The test build's bundle identifier (needed unless --recheck)" },
    themes: { type: 'string', value: 'list', help: 'Themes', default: THEMES.join(',') },
    langs: { type: 'string', value: 'list', help: 'Languages (add de,ckb before a release)', default: REQUIRED_LANGS.join(',') },
    game: { type: 'string', value: 'id', help: 'Design game id of the app', default: 'lineSiege' },
    root: { type: 'string', value: 'dir', help: 'Run folder root', default: '.parity' },
    reference: { type: 'string', value: 'dir', help: 'Reference root (default: the committed set)' },
    waivers: { type: 'string', value: 'file', help: 'Waiver file', default: 'parity/waivers.json' },
    recheck: { type: 'boolean', help: 'Do not capture; check and draw the existing runs again' },
    map: { type: 'string', value: 'file', help: 'Screen testID map', default: DEFAULTS.map },
    frames: { type: 'string', value: 'file', help: 'Frames manifest', default: DEFAULTS.frames },
    device: { type: 'string', value: 'file', help: 'Device profile', default: DEFAULTS.device },
    xcrun: { type: 'string', value: 'path', help: 'xcrun to use (passed to capture-app.mjs)' },
    maestro: { type: 'string', value: 'path', help: 'maestro to use (passed to capture-app.mjs)' },
    name: { type: 'string', value: 'name', help: "Simulator name (passed to capture-app.mjs; default: the device profile's, e07-parity)" },
    'driver-port': { type: 'string', value: 'port', help: "Maestro's XCUITest driver port (passed to capture-app.mjs; default: $PARITY_MAESTRO_PORT, else 22087)" },
    facts: { type: 'string', value: 'file', help: "The app's game facts: which reference variant a frame uses", default: FACTS_FILE },
    app: { type: 'string', value: 'id', help: 'App id in the facts file (needed when it lists several apps)' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Before the first run: setup-parity-sim.mjs (once per boot) and a Release test build installed on the',
    'parity simulator. After a PASS: read every sheet listed, then sign off with check-signoff.mjs.',
    'One parity simulator serves one session at a time. A second session on the same Mac makes its own simulator',
    '(setup-parity-sim.mjs --name e07-parity-<key>) and passes --name and its own --driver-port (or PARITY_MAESTRO_PORT),',
    "so Maestro's hierarchy call is never answered by the other session's driver on the default port 22087.",
    '',
    'Examples:',
    '  node run-parity.mjs --screen S4 --bundle-id com.example.linesiege',
    '  node run-parity.mjs --frame s11-settings --themes dark --langs fa --bundle-id <id>',
    '  node run-parity.mjs --screen S4 --recheck',
    '  node run-parity.mjs --screen S11 --bundle-id <id> --name e07-parity-b --driver-port 22187   (a second session)',
    '',
    'Frames with reference variants (s11-settings, s6-pause, s7-result-win) use the variant the app\'s facts in',
    'parity/game-facts.json select, and the summary names the reference of each frame. The Game-route frames',
    '(s6-pause, s7-*) probe the board once per theme and language (probe=board) and mask it.',
  ].join('\n'),
};

/** Run one of this skill's scripts; returns { status, problems: [{file, rule, message, fix}], out }. */
function runScript(name, args) {
  const r = spawnSync(process.execPath, [join(SCRIPTS_DIR, name), ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const problems = [];
  for (const line of out.split('\n')) {
    const m = /^FAIL (?:(\S+) )?\[([^\]]+)\] (.*?)(?: Fix: (.*))?$/.exec(line);
    if (m) problems.push({ file: m[1] ?? '', rule: m[2], message: m[3], fix: m[4] ?? '' });
  }
  // "ERROR [rule] <message> Fix: <fix>": keep the two apart so the relayed error has one Fix.
  const [error = null, errorFix = null] = /^ERROR \[[^\]]+\] (.*)$/m.exec(out)?.[1].split(' Fix: ') ?? [];
  return { status: r.status ?? 2, problems, error, errorFix, out };
}

/** Scroll offsets at which every body element of a tall frame is fully on screen at least once. */
function scrollOffsets(layoutPath, device) {
  if (!existsSync(layoutPath)) return [0];
  return scrollPlan(readJson(layoutPath, 'reference layout'), device);
}

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const { frames } = loadCatalogue({ mapPath: resolve(options.map), framesPath: resolve(options.frames) });
  let keys = listOption(options.frame, []);
  for (const id of listOption(options.screen, [])) {
    const matching = [...frames.values()].filter((f) => f.entries.some((e) => e.screen.toLowerCase() === id.toLowerCase())).map((f) => f.key);
    if (!matching.length) fail(`no frames for screen "${id}"`, 'Use a screen id such as S4 or S11a.');
    keys.push(...matching);
  }
  keys = [...new Set(keys)];
  if (!keys.length) fail('nothing to run: pass --frame <key> or --screen <id>', 'Run: node run-parity.mjs --help');
  for (const k of keys) if (!frames.has(k)) fail(`unknown frame "${k}"`, `Use one of: ${[...frames.keys()].join(', ')}`);
  if (!options.recheck && !options['bundle-id']) fail('--bundle-id is needed to capture', 'Pass the test build\'s bundle id, or --recheck to re-check existing runs.');
  // The app's game facts pick the reference of a frame with variants; no frame with variants, no facts needed.
  const needsFacts = keys.some((k) => Object.keys(frames.get(k).variants ?? {}).length > 0);
  const facts = needsFacts ? readGameFacts(resolve(options.facts), { app: options.app ?? null, game: options.game }) : null;
  const factsArgs = ['--facts', resolve(options.facts), ...(facts ? ['--app', facts.app] : options.app ? ['--app', options.app] : [])];
  const boardCacheDir = !options.recheck && keys.some((k) => frames.get(k).board) ? makeTempDir('run-parity-board-') : null;
  const boardArgs = boardCacheDir ? ['--board-cache', `${boardCacheDir}/board.json`] : [];
  const themes = listOption(options.themes, THEMES);
  const langs = listOption(options.langs, REQUIRED_LANGS);
  const device = readJson(resolve(options.device), 'device profile');
  const referenceRoot = resolve(options.reference ?? DEFAULTS.reference);
  const runsRoot = resolve(options.root);
  const show = (p) => relative(process.cwd(), p) || '.';
  const shared = ['--map', resolve(options.map), '--frames', resolve(options.frames), '--device', resolve(options.device)];
  const refArgs = options.reference ? ['--reference', referenceRoot] : [];
  const report = createReporter({ name: 'run-parity' });
  const table = [];
  const sheets = [];
  let runs = 0;
  if (facts) report.note(`facts ${show(facts.path)}: app ${facts.app} (${facts.designGame}), hasMusic ${facts.facts.hasMusic}, winLine ${facts.facts.winLine}`);
  for (const key of keys) {
    const frame = frames.get(key);
    if (frame.kind === 'mock-only') {
      table.push(`${key.padEnd(30)} mock-only: look at the reference image, nothing to capture`);
      continue;
    }
    const variant = facts ? variantFor(frame, facts.facts) : null;
    report.note(`frame ${key}: reference ${describeReference(key, variant)}${frame.board ? '; board masked from probe=board' : ''}`);
    for (const theme of themes) {
      for (const lang of langs) {
        const layoutPath = join(referenceRoot, options.game, `${theme}-${lang}`, `${referenceName(key, variant?.id)}.layout.json`);
        const offsets = frame.kind === 'phone-tall' ? scrollOffsets(layoutPath, device) : [0];
        if (!options.recheck) {
          // Captures at offsets this plan no longer uses would still be judged by check-signoff.
          const frameDir = join(runsRoot, options.game, key);
          const planned = new Set(offsets.map((y) => runDirName(theme, lang, y)));
          const old = existsSync(frameDir) ? readdirSync(frameDir).filter((name) => name.startsWith(`${theme}-${lang}-y`) && !planned.has(name)) : [];
          for (const name of old) {
            rmSync(join(frameDir, name), { recursive: true, force: true });
            report.note(`removed ${show(join(frameDir, name))} (a scroll offset the plan no longer uses)`);
          }
        }
        for (const scrollY of offsets) {
          runs += 1;
          const dir = defaultRunDir(runsRoot, { game: options.game, frame: key, theme, lang, scrollY });
          const label = `${key} ${theme}-${lang}${scrollY ? ` y${scrollY}` : ''}`;
          const relay = (result) => result.problems.forEach((p) => report.problem({ ...p, message: `${label}: ${p.message}` }));
          if (!options.recheck) {
            const extra = [
              ...(options.xcrun ? ['--xcrun', options.xcrun] : []),
              ...(options.maestro ? ['--maestro', options.maestro] : []),
              ...(options.name ? ['--name', options.name] : []),
              ...(options['driver-port'] ? ['--driver-port', options['driver-port']] : []),
            ];
            const cap = runScript('capture-app.mjs', ['--bundle-id', options['bundle-id'], '--frame', key, '--theme', theme, '--lang', lang, '--game', options.game, '--scroll', String(scrollY), '--root', runsRoot, ...extra, ...factsArgs, ...boardArgs, ...shared]);
            if (cap.status === 2) fail(`capture-app.mjs stopped on ${label}: ${cap.error ?? cap.out.trim().split('\n').at(-2)}`, cap.errorFix ?? 'Fix the environment (setup-parity-sim.mjs, the installed build), then run again.');
            if (cap.status !== 0) {
              relay(cap);
              table.push(`${label.padEnd(40)} CAPTURE FAILED (${cap.problems.map((p) => p.rule).join(', ')})`);
              continue;
            }
          } else if (!existsSync(join(dir, RUN_FILES.info))) {
            report.problem({ file: show(dir), rule: 'not-captured', message: `${label}: no run folder to re-check`, fix: 'Run without --recheck to capture it.' });
            table.push(`${label.padEnd(40)} NOT CAPTURED`);
            continue;
          }
          const check = runScript('check-parity.mjs', [dir, '--waivers', resolve(options.waivers), '--device', resolve(options.device), ...factsArgs, ...refArgs, '--map', resolve(options.map), '--frames', resolve(options.frames)]);
          if (check.status === 2) fail(`check-parity.mjs stopped on ${label}: ${check.error}`, check.errorFix ?? 'Fix the input it names, then run again.');
          relay(check);
          const sheet = runScript('make-sheet.mjs', [dir, '--device', resolve(options.device), ...refArgs]);
          if (sheet.status !== 0) relay(sheet);
          else sheets.push(show(join(dir, 'sheet.png')));
          const first = check.problems[0];
          table.push(`${label.padEnd(40)} ${check.status === 0 ? 'PASS' : `FAIL ${check.problems.length} (first: [${first?.rule}] ${first?.message.slice(0, 70) ?? ''})`}`);
        }
      }
    }
  }
  if (boardCacheDir) removeTempDir(boardCacheDir);
  for (const line of table) report.note(line);
  if (sheets.length) {
    report.note('Look at every sheet (sheet.png, zoom-*.png, eye-*.png, crops/) before signing off:');
    for (const s of sheets) report.note(`  ${s}`);
  }
  return report.finish({ checked: runs, unit: 'runs' });
});
