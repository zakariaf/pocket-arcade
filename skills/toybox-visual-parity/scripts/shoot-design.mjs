#!/usr/bin/env node
// shoot-design.mjs: renders the Toybox design frames at the parity device's geometry (1206 x 2622
// for a phone frame) with the installed Google Chrome, and writes each frame's layout.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';

import { createReporter, fail, makeTempDir, parseArgs, removeTempDir, requireFile, run, sha256 } from './check-lib.mjs';
import { CHROME_ARGS, launchChrome, loadImageDeps, loadPlaywright } from './lib/deps.mjs';
import { LANGS, MAP_METADATA_KEYS, THEMES, elementsForFacts, elementsForGame, listOption, loadCatalogue, mapMetadataOf, readDeck, referenceName } from './lib/frames.mjs';
import { referenceChangeProblems } from './lib/reference-changes.mjs';
import { DEFAULTS, SCRIPTS_DIR, readJson } from './lib/paths.mjs';
import { compactJson, encodePng, readPng } from './lib/png.mjs';
import { openDesign, shootFrame } from './lib/render.mjs';

const SPEC = {
  name: 'shoot-design',
  summary:
    'Renders design frames (every frame by default) in light and dark x en and fa at the parity device geometry ' +
    '(iPhone 16 Pro, 402 x 874 pt @3x, safe top 62) and writes <frame>.png (lossless) + <frame>.layout.json ' +
    '(testID rects, texts, styles, text runs), plus each reference variant a frame has for other game facts ' +
    '(<frame>--<variant>, derived from the rendered mockup by the DOM change frames.json names). --check re-renders ' +
    'and fails on any pixel or layout difference from the committed reference set.',
  usage: '(--out <dir> | --update-reference | --check) [options]',
  options: {
    out: { type: 'string', value: 'dir', help: 'Write renders to <dir>/<game>/<theme>-<lang>/ (use .parity/design in the app repo)' },
    'update-reference': { type: 'boolean', help: 'Rewrite the committed reference set in assets/reference/<game>/ (only after a deliberate design change)' },
    check: { type: 'boolean', help: 'Render to a temp folder and compare with the committed reference set; writes nothing' },
    'as-app': { type: 'boolean', help: 'With --out: also write design-as-app runs (<out>/runs/...) that check-parity must pass with 0 problems' },
    theme: { type: 'string', multiple: true, value: 'light|dark', help: 'Theme(s) to render (default: light and dark)' },
    lang: { type: 'string', multiple: true, value: 'en|de|fa|ckb', help: 'Language(s) to render (default: en and fa)' },
    game: { type: 'string', value: 'id', help: 'Design game id: lineSiege, flockTilt or scrapShove', default: 'lineSiege' },
    frame: { type: 'string', multiple: true, value: 'key', help: 'Frame key(s) such as s4-home (default: every frame)' },
    design: { type: 'string', value: 'file', help: 'Design HTML', default: DEFAULTS.design },
    map: { type: 'string', value: 'file', help: 'Screen testID map', default: DEFAULTS.map },
    frames: { type: 'string', value: 'file', help: 'Frames manifest', default: DEFAULTS.frames },
    device: { type: 'string', value: 'file', help: 'Device profile', default: DEFAULTS.device },
    reference: { type: 'string', value: 'dir', help: 'Reference root for --check / --update-reference', default: DEFAULTS.reference },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Chrome runs headless with --force-color-profile=srgb --font-render-hinting=none --disable-lcd-text',
    '--disable-gpu (software raster: GPU raster is not repeatable), deviceScaleFactor 3, reduced motion,',
    'animations disabled, every network request blocked (the design',
    'copy loads its fonts from assets/design/fonts/). Each frame is pinned at (0,0) and clipped.',
    '',
    'Examples:',
    '  node shoot-design.mjs --check                                   (prove the committed set is current)',
    '  node shoot-design.mjs --out .parity/design --game flockTilt     (references for another design game)',
    '  node shoot-design.mjs --out .parity/design --frame s4-home --theme dark --lang fa',
    '  node shoot-design.mjs --out .parity/self --as-app               (design-vs-design runs for check-parity)',
    '',
    'A frame renders with its variants (s11-settings also writes s11-settings--no-music). --update-reference keeps',
    'the manifest\'s referenceChanges log: add an entry for every deliberate change before re-rendering.',
  ].join('\n'),
};

function playwrightVersion() {
  try {
    return createRequire(join(SCRIPTS_DIR, 'package.json'))('playwright/package.json').version;
  } catch {
    return 'unknown';
  }
}

/** A Maestro-shaped hierarchy (integer point bounds, labels) of a design layout: design-as-app. */
function hierarchyFromLayout(layout, viewportHeight) {
  const children = [
    { attributes: { accessibilityText: '9:41 AM', 'resource-id': '', bounds: '[55,22][92,42]' }, children: [] },
  ];
  for (const el of layout.elements) {
    if (!el.rect) continue;
    // Like Maestro: children of accessible elements and parts hidden from VoiceOver are not listed.
    if (el.parent || el.a11yHidden) continue;
    if (viewportHeight !== null && el.rect.y >= viewportHeight) continue;
    const { x, y, w, h } = el.rect;
    const b = `[${Math.round(x)},${Math.round(y)}][${Math.round(x + w)},${Math.round(y + h)}]`;
    children.push({ attributes: { accessibilityText: el.aria ?? el.text ?? '', text: '', value: '', 'resource-id': el.testID, bounds: b }, children: [] });
  }
  return { attributes: { accessibilityText: '', 'resource-id': '', bounds: '[0,0][0,0]' }, children: [{ attributes: { accessibilityText: 'design-as-app', 'resource-id': '', bounds: '[0,0][402,874]' }, children }] };
}

/** Layouts are equal in everything the render measured; map metadata (MAP_METADATA_KEYS) is the map's. */
function sameLayout(a, b) {
  const measured = (layout) => ({ ...layout, elements: (layout.elements ?? []).map((el) => Object.fromEntries(Object.entries(el).filter(([k]) => !MAP_METADATA_KEYS.includes(k)))) });
  return sameJson(measured(a), measured(b));
}

function sameJson(a, b) {
  const walk = (x, y) => {
    if (typeof x === 'number' && typeof y === 'number') return Math.abs(x - y) <= 0.01;
    if (Array.isArray(x)) return Array.isArray(y) && x.length === y.length && x.every((v, i) => walk(v, y[i]));
    if (x && typeof x === 'object') {
      if (!y || typeof y !== 'object') return false;
      const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
      return [...keys].every((k) => walk(x[k], y[k]));
    }
    return x === y;
  };
  return walk(a, b);
}

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const modes = [options.out ? 'out' : null, options['update-reference'] ? 'update' : null, options.check ? 'check' : null].filter(Boolean);
  if (modes.length !== 1) fail('nothing to do: pass exactly one of --out <dir>, --update-reference or --check', 'Run: node shoot-design.mjs --help');
  if (options['as-app'] && !options.out) fail('--as-app needs --out <dir>', 'Pass --out .parity/self (or another folder).');
  const designPath = requireFile(resolve(options.design), 'design HTML');
  const device = readJson(resolve(options.device), 'device profile');
  const { frames, designFacts, manifest: framesManifest } = loadCatalogue({ mapPath: resolve(options.map), framesPath: resolve(options.frames) });
  const fixtureScore = framesManifest.fixture?.score ?? 1840;
  const deck = readDeck(designPath);
  const game = options.game;
  if (!deck.games?.[game]) fail(`game "${game}" is not in the design deck (${Object.keys(deck.games ?? {}).join(', ')})`, 'Use a design game id.');
  const themes = listOption(options.theme, THEMES);
  const langs = listOption(options.lang, ['en', 'fa']);
  for (const t of themes) if (!THEMES.includes(t)) fail(`unknown theme "${t}"`, 'Use light or dark.');
  for (const l of langs) if (!LANGS.includes(l)) fail(`unknown language "${l}"`, `Use one of ${LANGS.join(', ')}.`);
  const keys = listOption(options.frame, [...frames.keys()]);
  for (const k of keys) if (!frames.has(k)) fail(`unknown frame "${k}"`, `Use one of: ${[...frames.keys()].join(', ')}`);

  const referenceRoot = resolve(options.reference);
  const committed = join(referenceRoot, game);
  const tempRoot = modes[0] === 'check' ? makeTempDir('shoot-design-') : null;
  const outRoot = modes[0] === 'out' ? resolve(options.out) : modes[0] === 'update' ? referenceRoot : tempRoot;
  const gameDir = join(outRoot, game);
  const report = createReporter({ name: 'shoot-design' });
  const where = (file) => relative(process.cwd(), file) || file;

  const { PNG } = await loadImageDeps();
  const pw = await loadPlaywright();
  const browser = await launchChrome(pw);
  const files = {};
  const staleMetadata = [];
  let shots = 0;
  const started = Date.now();
  try {
    const combos = themes.flatMap((theme) => langs.map((lang) => ({ theme, lang })));
    // Theme x language renders run side by side: software raster leaves the CPU mostly idle otherwise.
    await Promise.all(
      combos.map(async ({ theme, lang }) => {
        const { context, page, blocked, errors, fonts, state } = await openDesign(browser, { designPath, theme, lang, game, device });
        const tag = `${theme}-${lang}`;
        try {
          for (const url of blocked) report.problem({ file: where(designPath), rule: 'offline', message: `[${tag}] the design requested ${url}`, fix: 'The design copy must load nothing from the network: re-import it with import-design.mjs.' });
          for (const message of errors) report.problem({ file: where(designPath), rule: 'design-error', message: `[${tag}] the design threw: ${message}`, fix: 'Use an intact design copy (import-design.mjs --check).' });
          for (const f of fonts.filter((face) => !face.ok)) report.problem({ file: where(designPath), rule: 'fonts', message: `[${tag}] ${f.family} ${f.weight} did not load from fonts/${f.file}`, fix: 'Run sync-shared.mjs so assets/design/fonts/ holds the bundled TTFs.' });
          if (state.theme !== theme || state.lang !== lang || state.game !== game) {
            report.problem({ file: where(designPath), rule: 'design-state', message: `[${tag}] the page shows theme ${state.theme}, language ${state.lang}, game ${state.game}`, fix: 'The page reads localStorage pa-toybox.theme/.lang/.game at load; keep that code in the design.' });
            return;
          }
          mkdirSync(join(gameDir, tag), { recursive: true });
          const plan = keys.flatMap((key) => [
            { key, variant: null },
            ...Object.values(frames.get(key).variants ?? {}).map((variant) => ({ key, variant })),
          ]);
          for (const { key: frameKey, variant } of plan) {
            const frame = frames.get(frameKey);
            const key = referenceName(frameKey, variant?.id);
            const elements = elementsForFacts(elementsForGame(frame, deck, game), variant?.facts ?? designFacts);
            const shot = await shootFrame(page, { frame, elements, device, variant, lang, fixtureScore });
            for (const p of shot.problems) {
              report.problem({ file: `${key}`, rule: p.rule, message: `[${tag}] ${p.message}`, fix: p.rule === 'variant-derive' ? `Fix frames.${frameKey}.variants.${variant?.id}.derive in frames.json (each step matches exactly one element of the rendered frame).` : 'Fix frameSelectors in screen-testids.json (the design may have reordered its frames).' });
            }
            if (!shot.png) continue;
            if (shot.caption !== frameKey) report.problem({ file: key, rule: 'frame-caption', message: `[${tag}] the selector reached the frame captioned "${shot.caption}"`, fix: 'Fix frameSelectors (or frameKeys) in screen-testids.json.' });
            const decoded = PNG.sync.read(shot.png);
            const expectW = shot.size.w * device.scale;
            const expectH = shot.size.h * device.scale;
            if (decoded.width !== expectW || decoded.height !== expectH) {
              report.problem({ file: key, rule: 'render-size', message: `[${tag}] rendered ${decoded.width} x ${decoded.height}, expected ${expectW} x ${expectH}`, fix: 'The frame must be pinned at (0,0) and clipped at device scale; check the parity CSS.' });
              continue;
            }
            const byId = new Map(elements.map((el) => [el.testID, el]));
            const layoutElements = shot.layout.elements.map((found) => {
              const el = byId.get(found.testID);
              if (found.count !== 1) {
                report.problem({ file: key, rule: 'exactly-one-match', message: `[${tag}] ${found.testID}: designSelector "${el.designSelector}" matched ${found.count} elements${found.error ? ` (${found.error})` : ''}`, fix: 'Fix the selector in screen-testids.json, then run check-testids.mjs.' });
              }
              return { testID: found.testID, screen: `${el.screen}/${el.variant}`, ...mapMetadataOf(el), ...found };
            });
            const layout = {
              version: 1,
              frame: frameKey,
              variant: variant?.id ?? null,
              facts: variant?.facts ?? designFacts,
              kind: frame.kind,
              screens: frame.entries.map((e) => `${e.screen}/${e.variant}`),
              root: frame.root,
              game,
              theme,
              lang,
              device: device.name,
              scale: device.scale,
              size: shot.size,
              image: `${key}.png`,
              elements: layoutElements,
              texts: shot.layout.texts,
            };
            const png = encodePng(PNG, { width: decoded.width, height: decoded.height, data: decoded.data });
            const layoutText = compactJson(layout);
            writeFileSync(join(gameDir, tag, `${key}.png`), png);
            writeFileSync(join(gameDir, tag, `${key}.layout.json`), layoutText);
            files[`${tag}/${key}.png`] = { sha256: sha256(png), bytes: png.length, width: decoded.width, height: decoded.height };
            files[`${tag}/${key}.layout.json`] = { sha256: sha256(layoutText), bytes: Buffer.byteLength(layoutText) };
            shots += 1;
            if (options['as-app'] && frame.kind !== 'mock-only') {
              const runDir = join(outRoot, 'runs', game, key, tag);
              mkdirSync(runDir, { recursive: true });
              const isPhone = frame.kind === 'phone' || frame.kind === 'phone-tall';
              const appHeight = isPhone ? Math.min(decoded.height, device.pixels.height) : decoded.height;
              const app = { width: decoded.width, height: appHeight, data: decoded.data.subarray(0, decoded.width * appHeight * 4) };
              writeFileSync(join(runDir, 'app.png'), encodePng(PNG, { ...app, data: Buffer.from(app.data) }));
              writeFileSync(join(runDir, 'app.hier.json'), `${JSON.stringify(hierarchyFromLayout(layout, isPhone ? device.points.height : null), null, 1)}\n`);
              const runInfo = { frame: frameKey, variant: variant?.id ?? null, theme, lang, game, scrollY: 0, source: 'design-as-app', capturedAt: new Date().toISOString() };
              if (!existsSync(join(committed, 'manifest.json'))) runInfo.referenceRoot = outRoot;
              writeFileSync(join(runDir, 'run.json'), `${JSON.stringify(runInfo, null, 1)}\n`);
            }
          }
        } finally {
          await context.close();
        }
      }),
    );
    const manifest = {
      version: 1,
      game,
      rendered: new Date().toISOString().slice(0, 10),
      renderer: { chrome: browser.version(), playwright: playwrightVersion(), flags: CHROME_ARGS.join(' ') },
      device: { name: device.name, points: device.points, scale: device.scale, safeTop: device.safeArea.top },
      inputs: {
        design: sha256(readFileSync(designPath)),
        map: sha256(readFileSync(resolve(options.map))),
        frames: sha256(readFileSync(resolve(options.frames))),
        deviceProfile: sha256(readFileSync(resolve(options.device))),
      },
      themes,
      langs,
      frames: keys,
      variants: keys.flatMap((key) => Object.keys(frames.get(key).variants ?? {}).map((id) => referenceName(key, id))),
      files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1))),
    };
    if (modes[0] !== 'check') {
      const manifestPath = join(gameDir, 'manifest.json');
      const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
      const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
      if (previous && modes[0] === 'out') manifest.files = sortKeys({ ...previous.files, ...files });
      if (modes[0] === 'update' && previous && (keys.length !== frames.size || themes.length !== previous.themes.length || langs.length !== previous.langs.length)) {
        manifest.files = sortKeys({ ...previous.files, ...files });
        manifest.themes = previous.themes;
        manifest.langs = previous.langs;
        manifest.frames = previous.frames;
        manifest.variants = previous.variants ?? manifest.variants;
      }
      // The log of deliberate reference changes is the owner's record: a re-render never drops it.
      if (previous?.referenceChanges) manifest.referenceChanges = previous.referenceChanges;
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
      report.note(`wrote ${shots} frames to ${where(gameDir)} in ${((Date.now() - started) / 1000).toFixed(1)} s (Chrome ${browser.version()})`);
    } else {
      const refManifestPath = join(committed, 'manifest.json');
      if (!existsSync(refManifestPath)) fail(`no committed reference set for ${game} (${where(refManifestPath)} missing)`, `Render one with --out, or use --game lineSiege.`);
      const refManifest = JSON.parse(readFileSync(refManifestPath, 'utf8'));
      for (const message of referenceChangeProblems(refManifest, { frames, known: new Set(Object.keys(refManifest.files ?? {})) })) {
        report.problem({ file: where(refManifestPath), rule: 'reference-changes', message, fix: 'Each entry is { id, date (YYYY-MM-DD), frames, variants, what, why } naming frames and variants of this set (signoff-and-waivers.md).' });
      }
      // The design and the device profile decide pixels: any change makes the set stale. The map and
      // the frames manifest also carry metadata no render reads (component names, checks, the
      // fixture): a change there is judged by the re-render itself, which compares every checked
      // frame's pixels and measured layout. A full check proves the whole set; a partial one only
      // the frames it re-rendered, and says so.
      const everything = keys.length === frames.size && THEMES.every((t) => themes.includes(t)) && (refManifest.langs ?? []).every((l) => langs.includes(l));
      for (const [input, hash] of Object.entries(manifest.inputs)) {
        if (refManifest.inputs?.[input] === hash) continue;
        if (input === 'map' || input === 'frames') {
          staleMetadata.push(input);
          continue;
        }
        report.problem({ file: where(refManifestPath), rule: 'stale-reference', message: `the ${input} changed since the references were rendered`, fix: 'If the design changed on purpose, run --update-reference and say so in the report; otherwise restore the input.' });
      }
      for (const [file, info] of Object.entries(files)) {
        const refPath = join(committed, file);
        if (!existsSync(refPath)) {
          report.problem({ file: where(refPath), rule: 'reference-missing', message: 'no committed reference for this render', fix: 'Run shoot-design.mjs --update-reference.' });
          continue;
        }
        if (file.endsWith('.png')) {
          const ref = readPng(PNG, refPath, 'reference');
          const fresh = readPng(PNG, join(gameDir, file), 'render');
          if (ref.width !== fresh.width || ref.height !== fresh.height) {
            report.problem({ file: where(refPath), rule: 'reference-drift', message: `size ${ref.width} x ${ref.height}, fresh render ${fresh.width} x ${fresh.height}`, fix: 'Find out what changed (Chrome, fonts, design); never commit a drifted set silently.' });
            continue;
          }
          let differing = 0;
          for (let i = 0; i < ref.data.length; i += 4) {
            if (ref.data[i] !== fresh.data[i] || ref.data[i + 1] !== fresh.data[i + 1] || ref.data[i + 2] !== fresh.data[i + 2]) differing += 1;
          }
          if (differing > 0) report.problem({ file: where(refPath), rule: 'reference-drift', message: `${differing} pixels differ from a fresh render (sha256 ${info.sha256.slice(0, 12)})`, fix: 'A renderer or font change moved pixels: compare the two images; update the set only when the change is understood and deliberate.' });
        } else {
          const ref = JSON.parse(readFileSync(refPath, 'utf8'));
          const fresh = JSON.parse(readFileSync(join(gameDir, file), 'utf8'));
          if (!sameLayout(ref, fresh)) report.problem({ file: where(refPath), rule: 'reference-drift', message: 'the layout differs from a fresh render', fix: 'Diff the two layout.json files to see which element moved.' });
        }
      }
      report.note(`re-rendered ${shots} frames in ${((Date.now() - started) / 1000).toFixed(1)} s and compared them with ${where(committed)}`);
      for (const input of staleMetadata) {
        report.note(everything
          ? `the ${input} changed since the references were rendered; every reference re-rendered the same (pixels and measured layout) unless a problem above says otherwise, so the change is metadata only (check-parity reads element metadata from the current map)`
          : `the ${input} changed since the references were rendered; only the ${shots} frame${shots === 1 ? '' : 's'} re-rendered here ${shots === 1 ? 'is' : 'are'} proven unaffected: run --check with no --frame, --theme or --lang to prove the rest`);
      }
    }
  } finally {
    await browser.close();
    if (tempRoot) removeTempDir(tempRoot);
  }
  return report.finish({ checked: shots, unit: 'frames' });
});
