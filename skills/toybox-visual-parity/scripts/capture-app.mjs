#!/usr/bin/env node
// capture-app.mjs: puts the app on one design frame through launch arguments, waits until the
// screen is still, takes the simulator screenshot and dumps element bounds with maestro hierarchy.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { createReporter, fail, parseArgs, run, sha256 } from './check-lib.mjs';
import { TOOLING_OPTION, loadImageDeps, toolingDirOf } from './lib/deps.mjs';
import { FACTS_FILE, LANGS, THEMES, describeFacts, describeReference, loadCatalogue, readGameFacts, referenceName, variantFor } from './lib/frames.mjs';
import { parseMaestroHierarchy } from './lib/hierarchy.mjs';
import { DEFAULTS, readJson } from './lib/paths.mjs';
import { RUN_FILES, defaultRunDir } from './lib/runs.mjs';
import { driverPortOf, findSimulator, freeDriverPort, maestroArgs, makeMaestro, makeSimctl, sleep } from './lib/tools.mjs';

/** The testID of the nonce marker the parity root renders for one launch. */
const launchMarker = (nonce) => `parity.launch.${nonce}`;

// System alerts that must never be on screen in a capture: Apple's tracking prompt (App Tracking
// Transparency), other permission prompts, and the "Open in ...?" alert of a deep link. The held S3
// consent moment in particular asks neither Google's form nor Apple's prompt.
const SYSTEM_ALERT = /Ask App Not to Track|to track your activity|Would Like to|Don[’']t Allow|Allow Once|^Open in [“"]/;

/** The first system-alert text in a dump, or null. */
function systemAlertIn(parsed) {
  return parsed.labels.find((label) => SYSTEM_ALERT.test(label)) ?? null;
}

const SPEC = {
  name: 'capture-app',
  summary:
    'Launches the app on the parity simulator straight into one design frame (-parity "frame=<key>&theme=..&lang=..' +
    '&game=..&date=..&animations=off" plus -AppleLanguages/-AppleLocale for the language), waits until two ' +
    'screenshots in a row are identical, saves app.png (1206 x 2622), dumps app.hier.json with maestro hierarchy, ' +
    'checks the screen did not change meanwhile and that the frame\'s root testID is on screen, and writes run.json. ' +
    'A frame with reference variants picks its reference from the app\'s game facts (parity/game-facts.json); a Game-route ' +
    'frame (S5, S6, S7) first launches once with probe=board to read the board rectangle the game reports, which ' +
    'check-parity masks. Every Maestro call names this simulator and this run\'s own driver port ' +
    '(--device <udid> --driver-host-port <port> before the command), and every launch carries a fresh nonce that the ' +
    'dump must contain (the marker parity.launch.<nonce>): a dump without it came from another simulator (exit 2).',
  usage: '--bundle-id <id> --frame <key> --theme light|dark --lang en|fa [options]',
  options: {
    'bundle-id': { type: 'string', value: 'id', help: 'The app\'s iOS bundle identifier (test build)' },
    frame: { type: 'string', value: 'key', help: 'Design frame key, e.g. s4-home' },
    theme: { type: 'string', value: 'light|dark', help: 'Theme' },
    lang: { type: 'string', value: 'code', help: 'Language: en, de, fa or ckb' },
    game: { type: 'string', value: 'id', help: 'Design game id of the app', default: 'lineSiege' },
    scroll: { type: 'string', value: 'pt', help: 'Scroll offset for tall frames (passed as scrollY)', default: '0' },
    root: { type: 'string', value: 'dir', help: 'Run folder root; the run goes to <root>/<game>/<frame>/<theme>-<lang>[-y<scroll>]', default: '.parity' },
    out: { type: 'string', value: 'dir', help: 'Exact run folder (overrides --root)' },
    'settle-ms': { type: 'string', value: 'ms', help: 'Longest wait for a still screen (default: the frame\'s settleMs or 8000)' },
    'no-hierarchy': { type: 'boolean', help: 'Skip maestro hierarchy (then write app.layout.json from an in-app reporter yourself)' },
    name: { type: 'string', value: 'name', help: 'Simulator name (default: the device profile\'s, e07-parity)' },
    device: { type: 'string', value: 'file', help: 'Device profile', default: DEFAULTS.device },
    frames: { type: 'string', value: 'file', help: 'Frames manifest', default: DEFAULTS.frames },
    map: { type: 'string', value: 'file', help: 'Screen testID map', default: DEFAULTS.map },
    xcrun: { type: 'string', value: 'path', help: 'xcrun to use (default: xcrun on PATH, or $PARITY_XCRUN)' },
    maestro: { type: 'string', value: 'path', help: 'maestro to use (default: $MAESTRO_BIN, PATH, ~/.maestro/bin/maestro)' },
    'driver-port': { type: 'string', value: 'port', help: "Maestro's XCUITest driver port for this session (default: $PARITY_MAESTRO_PORT, else a free port for this run)" },
    facts: { type: 'string', value: 'file', help: `The app's game facts (picks a frame's reference variant)`, default: FACTS_FILE },
    app: { type: 'string', value: 'id', help: 'App id in the facts file (needed when it lists several apps)' },
    'board-cache': { type: 'string', value: 'file', help: 'Board rectangles already probed in this run (run-parity passes one per run)' },
    tooling: TOOLING_OPTION,
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Install the Release test build first (xcrun simctl install <udid> <App>.app). Maestro needs Java 17 ($JAVA_HOME,',
    'or Android Studio\'s bundled JBR). The first hierarchy call installs Maestro\'s driver (about 20 s), later ones',
    'take about 11 s. Deep links are not used: they raise an "Open in ...?" alert that hides the app.',
    'One parity simulator serves one session at a time: each session uses its own simulator (--name, made with',
    'setup-parity-sim.mjs --name e07-parity-<key>). Maestro gets --device <udid> and --driver-host-port <port> before',
    'every command: the port is --driver-port (or PARITY_MAESTRO_PORT) when given, else a free port picked for this run.',
    'Each launch passes nonce=<hex> in -parity; the parity root renders the marker parity.launch.<nonce>, and a dump',
    'without it stops the capture (exit 2, "hierarchy from another simulator"). run.json records the UDID, the port and',
    'both nonces.',
    '',
    'Example:',
    '  node capture-app.mjs --bundle-id io.applander.linesiege --frame s4-home --theme dark --lang fa --name e07-parity',
    '  node capture-app.mjs --bundle-id io.applander.linesiege --frame s11-settings --theme light --lang en --scroll 573',
    '',
    'Reference variants: s11-settings, s6-pause, s7-result-win and s14-reset-all-progress have variants chosen by the',
    'app\'s facts (hasMusic, winLine, hasHints) in parity/game-facts.json; the variants a frame\'s facts match compose',
    '(s6-pause--no-music--no-hints). run.json records the one used. A missing or mismatched facts file (a fact left out',
    'included) is exit 2. run.json also records systemAlert: null when no system alert was on screen.',
    'Board probe: for s6-pause and the s7 frames the app is first launched with probe=board (no frame state; the host',
    'renders game.board-layout), and the board rectangle goes into run.json "board".',
  ].join('\n'),
};

const STATUS_ARGS = (o) => [
  '--time', o.time, '--dataNetwork', o.dataNetwork, '--wifiMode', o.wifiMode, '--wifiBars', o.wifiBars,
  '--cellularMode', o.cellularMode, '--cellularBars', o.cellularBars, '--operatorName', o.operatorName,
  '--batteryState', o.batteryState, '--batteryLevel', o.batteryLevel,
];

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const missing = ['bundle-id', 'frame', 'theme', 'lang'].filter((k) => !options[k]);
  if (missing.length) fail(`nothing to capture: pass ${missing.map((k) => `--${k}`).join(', ')}`, 'Run: node capture-app.mjs --help');
  if (!THEMES.includes(options.theme)) fail(`unknown theme "${options.theme}"`, 'Use light or dark.');
  if (!LANGS.includes(options.lang)) fail(`unknown language "${options.lang}"`, `Use one of ${LANGS.join(', ')}.`);
  const scrollY = Number(options.scroll);
  // Whole points: the harness's parser refuses anything else (and would show its error view).
  if (!Number.isInteger(scrollY) || scrollY < 0) fail(`--scroll must be whole points >= 0, got "${options.scroll}"`, 'Pass e.g. --scroll 600.');
  const device = readJson(resolve(options.device), 'device profile');
  const { frames, manifest } = loadCatalogue({ mapPath: resolve(options.map), framesPath: resolve(options.frames) });
  const frame = frames.get(options.frame);
  if (!frame) fail(`unknown frame "${options.frame}"`, `Use one of: ${[...frames.keys()].join(', ')}`);
  if (frame.kind === 'mock-only') fail(`${frame.key} is mock-only: Google draws that sheet, so there is nothing of the app to capture`, 'Look at the reference image instead.');
  // A frame whose design depends on what the game has (Music, the win line) takes its reference
  // from the app's facts; the facts are never guessed.
  const hasVariants = Object.keys(frame.variants ?? {}).length > 0;
  const facts = hasVariants ? readGameFacts(resolve(options.facts), { app: options.app ?? null, game: options.game }) : null;
  const variant = facts ? variantFor(frame, facts.facts) : null;
  const settleMs = Number(options['settle-ms'] ?? frame.settleMs ?? 8000);
  const givenPort = driverPortOf(options['driver-port']);
  const driverPort = givenPort ?? (await freeDriverPort());
  const simctl = makeSimctl(options.xcrun);
  const name = options.name ?? device.simulatorName;
  const sim = findSimulator(simctl, name).find((f) => f.runtime === device.runtime && f.device.state === 'Booted');
  if (!sim) fail(`the ${name} simulator is not booted`, `Run: node setup-parity-sim.mjs --appearance ${options.theme}`);
  const udid = sim.device.udid;
  const outDir = resolve(options.out ?? defaultRunDir(resolve(options.root), { game: options.game, frame: frame.key, theme: options.theme, lang: options.lang, scrollY }));
  mkdirSync(outDir, { recursive: true });
  const report = createReporter({ name: 'capture-app' });
  const file = relative(process.cwd(), join(outDir, RUN_FILES.app)) || RUN_FILES.app;
  const problem = (rule, message, fix) => report.problem({ file, rule, message, fix });
  const step = (text) => report.note(`step  ${text}`);
  report.note(`reference ${describeReference(frame.key, variant)}${facts ? ` from ${relative(process.cwd(), facts.path) || facts.path} (app ${facts.app}: ${describeFacts(facts.facts)})` : ''}`);
  report.note(`simulator ${name} ${udid}, Maestro driver port ${driverPort}${givenPort ? ' (given)' : ' (free port for this run)'}`);

  // 1. The simulator shows the right appearance and a clean status bar.
  if (simctl('ui', udid, 'appearance').stdout.trim() !== options.theme) {
    step(`appearance ${options.theme}`);
    simctl('ui', udid, 'appearance', options.theme);
  }
  if (!simctl('status_bar', udid, 'list').stdout.includes(device.statusBarOverride.time)) {
    step('re-applying the status bar override (a reboot clears it)');
    simctl('status_bar', udid, 'override', ...STATUS_ARGS(device.statusBarOverride));
  }

  // 2. Nothing else in front (another app would add a "back to" breadcrumb to the status bar). Maestro's
  // XCUITest driver stays: stopping it makes the next hierarchy call reinstall it (20 s).
  const running = simctl('spawn', udid, 'launchctl', 'list').stdout;
  for (const m of running.matchAll(/UIKitApplication:([A-Za-z0-9.-]+)\[/g)) {
    if (m[1] !== options['bundle-id'] && !m[1].startsWith('dev.mobile.maestro-driver')) simctl('terminate', udid, m[1]);
  }

  // 3. Launch straight into the frame. Arguments are separate words (no shell), so "(fa)" arrives intact.
  const langArgs = device.languages?.[options.lang] ?? { appleLanguages: `(${options.lang})`, appleLocale: options.lang };
  // Each launch gets a fresh nonce; the dump that follows must contain its marker.
  const launchWith = (extra) => {
    const nonce = randomBytes(6).toString('hex');
    const query = new URLSearchParams({ frame: frame.key, theme: options.theme, lang: options.lang, game: options.game, ...(manifest.launchDefaults ?? {}), ...extra, nonce });
    const args = ['-AppleLanguages', langArgs.appleLanguages, '-AppleLocale', langArgs.appleLocale, '-parity', query.toString()];
    step(`launch ${options['bundle-id']} on ${udid} ${args.join(' ')}`);
    const launched = simctl('launch', '--terminate-running-process', udid, options['bundle-id'], ...args);
    if (launched.status !== 0) {
      fail(`the app did not launch: ${(launched.stderr || launched.stdout).trim().split('\n')[0]}`, `Install the test build first: xcrun simctl install ${udid} <path to the .app> (and check --bundle-id).`);
    }
    return { args, nonce };
  };

  // 4. Wait for a still screen: two screenshots in a row, 300 ms apart, the same outside the masked
  // status bar and home indicator (the home indicator comes and goes once XCUITest has touched the
  // app) and within 3/255 per channel (shadow dithering changes on a redraw).
  const { PNG } = await loadImageDeps(toolingDirOf(options));
  const masks = device.masks.map((m) => ({ x0: m.x * device.scale, y0: m.y * device.scale, x1: (m.x + m.width) * device.scale, y1: (m.y + m.height) * device.scale }));
  const sameScreen = (bufA, bufB) => {
    if (bufA.equals(bufB)) return true;
    let a;
    let b;
    try {
      a = PNG.sync.read(bufA);
      b = PNG.sync.read(bufB);
    } catch {
      return false;
    }
    if (a.width !== b.width || a.height !== b.height) return false;
    for (let y = 0; y < a.height; y += 1) {
      for (let x = 0; x < a.width; x += 1) {
        const i = (y * a.width + x) * 4;
        // iOS re-dithers hard shadows on a redraw (+-1 per channel); that is not a change.
        if (Math.abs(a.data[i] - b.data[i]) <= 3 && Math.abs(a.data[i + 1] - b.data[i + 1]) <= 3 && Math.abs(a.data[i + 2] - b.data[i + 2]) <= 3) continue;
        if (masks.some((m) => x >= m.x0 && x < m.x1 && y >= m.y0 && y < m.y1)) continue;
        return false;
      }
    }
    return true;
  };
  // shot(): one screenshot. simctl's own notes ("Detected file type", "Note: No display specified")
  // are not the error, so the message quotes the other stderr lines; one transient failure is retried.
  const shot = (path) => {
    let r = simctl('io', udid, 'screenshot', '--type=png', path);
    if (r.status !== 0 || !existsSync(path)) r = simctl('io', udid, 'screenshot', '--type=png', path);
    if (r.status !== 0 || !existsSync(path)) {
      const lines = (r.stderr || '').split('\n').map((l) => l.trim()).filter((l) => l && !/^(Note:|Detected file type)/.test(l));
      fail(`simctl screenshot failed twice (exit ${String(r.status)}): ${lines.join(' ').slice(0, 300) || 'no error text'}`, 'Check that the simulator is booted and not showing a crash dialog.');
    }
    return readFileSync(path);
  };
  const tmp = (n) => join(outDir, `.capture-${n}.png`);
  // settle(): screenshots 300 ms apart until two in a row are the same; null when the time runs out.
  const settle = async (first) => {
    const began = Date.now();
    let previous = first ?? shot(tmp(0));
    for (let n = 1; Date.now() - began < settleMs; n += 1) {
      await sleep(300);
      const current = shot(tmp(n % 2));
      if (sameScreen(current, previous)) return { stable: current, previous };
      previous = current;
    }
    return { stable: null, previous };
  };
  const cleanTmp = () => ['0', '1', 'after'].forEach((n) => rmSync(tmp(n), { force: true }));
  const unstable = (last) => {
    cleanTmp();
    problem('unstable', `the screen never held still for 300 ms within ${settleMs} ms (an animation, a timer or a loading state is running)`, 'The parity harness must start the frame with animations off and all data ready; raise --settle-ms only for a slow first launch.');
    writeFileSync(join(outDir, RUN_FILES.app), last);
    return report.finish({ checked: 1, unit: 'captures' });
  };
  const maestro = options['no-hierarchy'] ? null : makeMaestro(options.maestro);
  const target = { udid, driverPort };
  if (!options['no-hierarchy'] && !maestro) fail('Maestro is not installed', 'Install Maestro 2.10 (see the e2e-maestro skill), or set $MAESTRO_BIN; Java 17 must be available.');
  // A dump belongs to this launch only when it holds the launch's nonce marker: without it, the
  // XCUITest driver that answered serves another simulator (round 3: another session's Settings).
  // XCUITest can also answer once with only the status bar, before the app's accessibility tree is
  // attached (round 5: one dump in 160 held nothing but "3 of 3 Wi-Fi bars"), so a dump without the
  // marker is read again after a short wait; only MARKER_DUMPS dumps in a row without it stop the
  // capture. Another simulator's driver never shows this launch's marker, so the guard still holds.
  const MARKER_DUMPS = 3;
  const dumpHierarchy = async (nonce) => {
    for (let dump = 1; ; dump += 1) {
      let r = maestro(...maestroArgs(target, 'hierarchy', '--no-reinstall-driver'));
      if (r.status !== 0) r = maestro(...maestroArgs(target, 'hierarchy'));
      let json;
      try {
        json = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
      } catch {
        cleanTmp();
        return fail(`maestro hierarchy did not print JSON (exit ${r.status}): ${(r.stderr || r.stdout).trim().split('\n').slice(-1)[0]}`, maestro.javaHome ? 'Run the same command by hand to see the error.' : 'Maestro needs Java 17: set JAVA_HOME.');
      }
      const parsed = parseMaestroHierarchy(json);
      if (parsed.elements.has(launchMarker(nonce))) return json;
      if (dump < MARKER_DUMPS) {
        step(`the dump has no ${launchMarker(nonce)} yet (${parsed.elements.size} elements; the app's tree may not be attached): reading it again in 2 s`);
        await sleep(2000);
        continue;
      }
      cleanTmp();
      writeFileSync(join(outDir, 'rejected.hier.json'), `${JSON.stringify(json, null, 1)}\n`);
      return fail(
        `hierarchy from another simulator: the dump has no ${launchMarker(nonce)}, the marker of this launch on ${udid} (driver port ${driverPort}), in ${MARKER_DUMPS} dumps in a row; the last was kept as rejected.hier.json`,
        'Give this session its own simulator (--name e07-parity-<key>) and let capture-app pick a free driver port (or pass an unused --driver-port). If the app never shows the marker, its parity root or a modal root lacks ParityLaunchMarker (check-harness.mjs, rule harness-launch-marker).',
      );
    }
  };

  // 3b. A Game-route frame (S5, S6, S7) masks the board the game draws: each game brings its own
  // board, so the design has none to compare. A first launch with probe=board opens no frame state
  // and makes the host render game.board-layout (the canvas origin and BoardLayout in window points);
  // its rectangle is cached per device, theme and language for the rest of the run.
  let board = null;
  if (frame.board) {
    const cacheKey = `${device.name}|${options.theme}|${options.lang}|${options.game}`;
    const cachePath = options['board-cache'] ? resolve(options['board-cache']) : null;
    const cache = cachePath && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
    if (cache[cacheKey]) {
      board = { ...cache[cacheKey], cached: true };
      step(`board rectangle from this run's probe: ${JSON.stringify(board.rect)}`);
    } else if (maestro) {
      const probeLaunch = launchWith({ probe: 'board' });
      await sleep(1000);
      const probeSettled = await settle(null);
      if (!probeSettled.stable) return unstable(probeSettled.previous);
      step('maestro hierarchy of the board probe');
      const probed = parseMaestroHierarchy(await dumpHierarchy(probeLaunch.nonce));
      const text = probed.elements.get('game.board-layout')?.label ?? null;
      let parsed = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }
      const w = Number(parsed?.layout?.width);
      const h = Number(parsed?.layout?.height);
      if (!parsed || !Number.isFinite(parsed.x) || !Number.isFinite(parsed.y) || !(w > 0) || !(h > 0)) {
        cleanTmp();
        problem('board-probe', `the probe=board launch showed no usable game.board-layout (${text ? `text ${text.slice(0, 80)}` : 'not on screen'}), so the board cannot be masked`,
          'In a parity probe launch the host must render the board-layout probe: parity-session\'s isParityBoardProbeOn() is true, and the host\'s isLayoutProbeOn closure must return true while it is (game-host-integration); the probe opens no frame state.');
        return report.finish({ checked: 1, unit: 'captures' });
      }
      board = { rect: { x: parsed.x, y: parsed.y, w, h }, source: 'probe=board', probedAt: new Date().toISOString(), nonce: probeLaunch.nonce };
      step(`board rectangle ${JSON.stringify(board.rect)}`);
      if (cachePath) writeFileSync(cachePath, `${JSON.stringify({ ...cache, [cacheKey]: board }, null, 1)}\n`);
    }
  }

  const { args: launchArgs, nonce } = launchWith(scrollY ? { scrollY: String(scrollY) } : {});
  const started = Date.now();
  await sleep(1000);
  let settled = await settle(null);
  if (!settled.stable) return unstable(settled.previous);
  let stable = settled.stable;
  step(`screen still after ${Date.now() - started} ms`);

  // 5. Element bounds, and proof that the screen did not change while they were read. A launch
  // screen or a late data load can hold still for 300 ms, so a change during the dump means: settle
  // again and dump again (3 attempts).
  let hierarchy = null;
  let systemAlert = null;
  if (maestro) {
    let accepted = false;
    for (let attempt = 1; attempt <= 3 && !accepted; attempt += 1) {
      step(`maestro hierarchy, attempt ${attempt} (about 11 s; 20 s the first time)`);
      hierarchy = await dumpHierarchy(nonce);
      const after = shot(tmp('after'));
      if (sameScreen(after, stable)) {
        accepted = true;
        break;
      }
      if (attempt === 3) break;
      step('the screen changed while the hierarchy was read: settling again');
      settled = await settle(after);
      if (!settled.stable) return unstable(settled.previous);
      stable = settled.stable;
    }
    if (!accepted) problem('changed-during-capture', 'the screen changed while the hierarchy was read, 3 times in a row, so bounds and pixels may not match', 'Stop timers and animations in parity mode (the harness freezes them), then capture again.');
    writeFileSync(join(outDir, RUN_FILES.hier), `${JSON.stringify(hierarchy, null, 1)}\n`);
    const parsed = parseMaestroHierarchy(hierarchy);
    systemAlert = systemAlertIn(parsed);
    if (systemAlert) problem('system-alert', `a system alert is on screen: "${systemAlert}"`, 'Nothing may ask the system in a parity launch: the held consent moment (S3) never requests Google\'s form or Apple\'s tracking prompt, and captures never use deep links. Dismiss it, find what asked, and capture again.');
    const reached = frame.root && (parsed.elements.has(frame.root) || (frame.modal && parsed.elements.has(frame.modal.reachedBy)));
    if (frame.root && !reached) {
      const known = frame.elements.filter((el) => parsed.elements.has(el.testID)).length;
      const labels = parsed.labels.filter(Boolean).slice(0, 5).map((l) => `"${l}"`).join(', ');
      problem('screen-not-reached', `the root testID ${frame.root} is not on screen (${known} of the frame's testIDs found; the screen shows ${labels || 'no labels'})`,
        'Check the parity harness handles this frame key, and that no system alert is up; then capture again.');
    } else {
      step(`${frame.elements.filter((el) => parsed.elements.has(el.testID)).length} of ${frame.elements.length} frame testIDs on screen`);
    }
  }
  cleanTmp();
  writeFileSync(join(outDir, RUN_FILES.app), stable);
  const { PNG_WIDTH, PNG_HEIGHT } = { PNG_WIDTH: stable.readUInt32BE(16), PNG_HEIGHT: stable.readUInt32BE(20) };
  if (PNG_WIDTH !== device.pixels.width || PNG_HEIGHT !== device.pixels.height) {
    problem('capture-size', `the screenshot is ${PNG_WIDTH} x ${PNG_HEIGHT}, not ${device.pixels.width} x ${device.pixels.height}`, `Use the ${name} simulator (${device.name}); run setup-parity-sim.mjs.`);
  }
  const info = {
    version: 1,
    frame: frame.key,
    variant: variant?.id ?? null,
    referenceName: referenceName(frame.key, variant?.id),
    kind: frame.kind,
    theme: options.theme,
    lang: options.lang,
    game: options.game,
    scrollY,
    bundleId: options['bundle-id'],
    simulator: { name, udid, runtime: device.runtime, driverPort },
    launchArgs,
    nonce,
    ...(maestro ? { hierarchyNonce: launchMarker(nonce), systemAlert } : {}),
    ...(facts ? { facts: { file: relative(process.cwd(), facts.path) || facts.path, app: facts.app, ...facts.facts } } : {}),
    ...(board ? { board } : {}),
    capturedAt: new Date().toISOString(),
    appSha256: sha256(stable),
  };
  const infoPath = join(outDir, RUN_FILES.info);
  writeFileSync(`${infoPath}.tmp`, `${JSON.stringify(info, null, 1)}\n`);
  renameSync(`${infoPath}.tmp`, infoPath);
  rmSync(join(outDir, RUN_FILES.report), { force: true });
  report.note(`run   ${relative(process.cwd(), outDir) || '.'} (next: check-parity.mjs on this folder)`);
  return report.finish({ checked: 1, unit: 'captures' });
});
