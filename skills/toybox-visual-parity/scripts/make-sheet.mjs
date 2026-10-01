#!/usr/bin/env node
// make-sheet.mjs: the images Claude reads in the look pass: design | app | diff side by side,
// zoomed bands, a crop for every failing element and a contact sheet of the eye-check elements.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { createReporter, fail, parseArgs, run, sha256 } from './check-lib.mjs';
import { TOOLING_OPTION, loadImageDeps, toolingDirOf } from './lib/deps.mjs';
import { TOLERANCES, frameGeometry, isCropOnly } from './lib/gates.mjs';
import { parseAppLayout, parseMaestroHierarchy } from './lib/hierarchy.mjs';
import { DEFAULTS, readJson } from './lib/paths.mjs';
import { blank, blit, crop, downscale, encodePng, fillRect, outline, readPng } from './lib/png.mjs';
import { RUN_FILES, findRunDirs, readRun } from './lib/runs.mjs';

const SPEC = {
  name: 'make-sheet',
  summary:
    'Builds the look-pass images for run folders: sheet.png (design | app | diff at 1 px per pt, failing elements ' +
    'outlined in magenta, masks hatched), zoom-1..n.png (design | app bands at 2x), crops/<testID>.png (design | app | ' +
    'diff at 3x for every failing element) and eye-<n>.png (every icon, logo and picture as design | app pairs). ' +
    'Writes sheets.json with the sha256 of each image for the sign-off ledger.',
  usage: '<run-dir>... | --runs <folder> [options]',
  options: {
    runs: { type: 'string', value: 'folder', help: 'Every run folder under this folder' },
    out: { type: 'string', value: 'dir', help: 'Write the images here instead of into the run folder (one run only)' },
    reference: { type: 'string', value: 'dir', help: 'Reference root (default: the committed set)' },
    device: { type: 'string', value: 'file', help: 'Device profile', default: DEFAULTS.device },
    tooling: TOOLING_OPTION,
  },
  positionals: { min: 0, max: Infinity },
  details: [
    'Read sheet.png first (whole screen), then each zoom band, then the crops of failing elements, then',
    'eye-*.png. Colours in the diff panel: red = the app is lighter or different, blue = the app is darker,',
    'grey hatching = masked (status bar, home indicator, ads, the game board a Game-route frame masks). Run check-parity.mjs first so',
    'the failing elements are outlined. A scrolled capture of a tall frame is compared with the design window it',
    'should show (fixed top bar, scrolled body, pinned banner); sheet.png adds the full-height design with that',
    'window between cyan lines.',
    '',
    'Example: node make-sheet.mjs .parity/lineSiege/s4-home/light-en',
  ].join('\n'),
};

const GUTTER = 12;
const BG = [40, 40, 48, 255];
const MAGENTA = [255, 0, 200];
const CYAN = [0, 200, 255];

function hatch(img, x, y, w, h) {
  for (let py = Math.max(0, y); py < Math.min(img.height, y + h); py += 1) {
    for (let px = Math.max(0, x); px < Math.min(img.width, x + w); px += 1) {
      if ((px + py) % 8 < 3) img.data.set([150, 150, 160, 255], (py * img.width + px) * 4);
    }
  }
}

/** Side by side panels with gutters; panels may differ in height. */
function row(panels) {
  const w = panels.reduce((s, p) => s + p.width, 0) + GUTTER * (panels.length + 1);
  const h = Math.max(...panels.map((p) => p.height)) + GUTTER * 2;
  const out = blank(w, h, BG);
  let x = GUTTER;
  for (const p of panels) {
    blit(p, out, x, GUTTER);
    x += p.width + GUTTER;
  }
  return out;
}

function stack(rows) {
  const w = Math.max(...rows.map((r) => r.width));
  const h = rows.reduce((s, r) => s + r.height, 0);
  const out = blank(w, h, BG);
  let y = 0;
  for (const r of rows) {
    blit(r, out, 0, y);
    y += r.height;
  }
  return out;
}

/**
 * The design as one capture of a tall frame shows it: the fixed header, the body scrolled by the
 * measured shift (clipped at the end of the body) and the pinned banner at the bottom. The diff and
 * the zoom bands compare this window with the app; other frames use the design as it is.
 */
function designWindow(design, geo, shiftPt, height, S) {
  const out = blank(design.width, height, [0, 0, 0, 255]);
  const hb = Math.round(geo.headerBottom * S);
  const bb = Math.min(height, Math.round(geo.bodyBottom * S));
  blit(crop(design, 0, 0, design.width, hb), out, 0, 0);
  blit(crop(design, 0, hb - Math.round(shiftPt * S), design.width, bb - hb), out, 0, hb);
  if (bb < height) blit(crop(design, 0, bb - Math.round(geo.pinShift * S), design.width, height - bb), out, 0, bb);
  return out;
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const dirs = positionals.map((p) => resolve(p));
  if (options.runs) dirs.push(...findRunDirs(resolve(options.runs)));
  if (dirs.length === 0) fail('nothing to draw: pass run folders or --runs <folder>', 'Run: node make-sheet.mjs --help');
  if (options.out && dirs.length !== 1) fail('--out works with exactly one run folder', 'Drop --out to write into each run folder.');
  const device = readJson(resolve(options.device), 'device profile');
  const S = device.scale;
  const { PNG, pixelmatch } = await loadImageDeps(toolingDirOf(options));
  const report = createReporter({ name: 'make-sheet' });
  const show = (p) => relative(process.cwd(), p) || '.';
  let made = 0;
  for (const dir of dirs) {
    const r = readRun(dir, { referenceRoot: options.reference });
    const file = show(r.app);
    if (!existsSync(r.reference.image) || !existsSync(r.reference.layout)) {
      report.problem({ file, rule: 'reference-missing', message: `no design reference at ${show(r.reference.image)}`, fix: 'Render it with shoot-design.mjs (see check-parity.mjs --help).' });
      continue;
    }
    const layout = JSON.parse(readFileSync(r.reference.layout, 'utf8'));
    const design = readPng(PNG, r.reference.image, 'design reference');
    const app = readPng(PNG, r.app, 'app capture');
    const isPhone = layout.kind === 'phone' || layout.kind === 'phone-tall';
    const sizeOk = isPhone ? app.width === device.pixels.width && app.height === device.pixels.height : app.width === device.pixels.width;
    if (!sizeOk) {
      report.problem({ file, rule: 'capture-size', message: `app.png is ${app.width} x ${app.height} px, not the parity device's ${device.pixels.width} x ${device.pixels.height}`, fix: `Re-capture on the "${device.simulatorName}" simulator (capture-app.mjs).` });
      continue;
    }
    const reportPath = join(dir, RUN_FILES.report);
    const runReport = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : null;
    if (runReport && runReport.app?.imageSha256 !== sha256(readFileSync(r.app))) {
      report.problem({ file: show(reportPath), rule: 'stale-report', message: 'report.json was made from a different app.png', fix: 'Run check-parity.mjs on this run folder again, then make the sheet.' });
      continue;
    }
    if (!runReport) report.note(`note  ${show(dir)}: no report.json yet, so nothing is outlined (run check-parity.mjs first)`);
    // Problem rects are page coordinates with a viewRect for the screen; an older report mixed the two.
    if (runReport && (runReport.problems ?? []).some((p) => p.rect && !p.viewRect)) {
      report.problem({ file: show(reportPath), rule: 'stale-report', message: 'report.json was written by an older check-parity.mjs (problem rects without viewRect, so a scrolled capture would crop the wrong design element)', fix: 'Run check-parity.mjs on this run folder again, then make the sheet.' });
      continue;
    }
    const outDir = options.out ? resolve(options.out) : dir;
    mkdirSync(outDir, { recursive: true });
    const failing = (runReport?.problems ?? []).filter((p) => p.rect);
    const boundsPath = r.appLayout ?? r.hier;
    const bounds = boundsPath ? (r.appLayout ? parseAppLayout(readJson(boundsPath)) : parseMaestroHierarchy(readJson(boundsPath))) : { elements: new Map() };

    // Tall frames: the part of the design this capture shows (header, scrolled body, pinned banner).
    const geo = frameGeometry(layout, device);
    const shiftPt = geo.tall ? (runReport?.stats?.scrollShiftPt ?? -(r.info.scrollY ?? 0)) : 0;
    const view = geo.tall ? designWindow(design, geo, shiftPt, app.height, S) : design;
    const byId = new Map(layout.elements.filter((el) => el.rect).map((el) => [el.testID, el]));
    const toView = (rect, testID) => {
      if (!geo.tall) return rect;
      const el = byId.get(testID);
      const dy = el && geo.isPinned(el) ? geo.pinShift : (el ? geo.inBody(el) : testID === layout.root && rect.y >= geo.topBarBottom) ? shiftPt : 0;
      return { ...rect, y: rect.y + dy };
    };

    // Diff (full width, common height) with masks hatched.
    const common = Math.min(view.height, app.height);
    const d0 = crop(view, 0, 0, view.width, common);
    const a0 = crop(app, 0, 0, app.width, common);
    const diff = blank(view.width, common);
    pixelmatch(d0.data, a0.data, diff.data, view.width, common, { threshold: TOLERANCES.pixelmatchThreshold, alpha: 0.3, diffColor: [230, 30, 30], diffColorAlt: [30, 90, 230] });
    const maskRects = [
      ...(isPhone ? device.masks.map((m) => ({ x: m.x, y: m.y, w: m.width, h: m.height })) : []),
      ...layout.elements.filter((el) => el.mask && el.rect).map((el) => toView(el.rect, el.testID)),
      // The game's board of a Game-route frame (probe=board), minus what is drawn over it.
      ...(runReport?.stats?.boardMask?.pieces ?? []),
    ];
    for (const m of maskRects) hatch(diff, Math.round(m.x * S), Math.round(m.y * S), Math.round(m.w * S), Math.round(m.h * S));
    const designMarked = { width: design.width, height: design.height, data: Buffer.from(design.data) };
    const viewMarked = geo.tall ? { width: view.width, height: view.height, data: Buffer.from(view.data) } : designMarked;
    const appMarked = { width: app.width, height: app.height, data: Buffer.from(app.data) };
    const box = (img, rr, rgb) => outline(img, Math.round(rr.x * S), Math.round(rr.y * S), Math.round(rr.w * S), Math.round(rr.h * S), rgb, 6);
    for (const p of failing) {
      const vr = p.viewRect ?? toView(p.rect, p.testID);
      box(designMarked, p.rect, MAGENTA);
      if (viewMarked !== designMarked) box(viewMarked, vr, MAGENTA);
      box(appMarked, p.appRect ?? (p.testID && bounds.elements.get(p.testID)) ?? vr, MAGENTA);
      box(diff, vr, MAGENTA);
    }
    if (geo.tall) {
      // The body window this capture shows, on the full-height design.
      box(designMarked, { x: 0, y: geo.headerBottom - shiftPt, w: design.width / S, h: geo.bodyBottom - geo.headerBottom }, CYAN);
    }
    const files = {};
    const save = (name, img) => {
      const buf = encodePng(PNG, img);
      writeFileSync(join(outDir, name), buf);
      files[name] = sha256(buf);
    };
    // 1. Overview at 1 px per pt.
    // Tall frames: design window | app | diff, then the full-height design with the window in cyan.
    const panels = geo.tall ? [viewMarked, appMarked, diff, designMarked] : [designMarked, appMarked, diff];
    save('sheet.png', row(panels.map((img) => downscale(img, S))));
    // 2. Zoomed bands at 2x: design | app, about 220 pt tall each.
    const bandPt = 220;
    const bands = Math.ceil(common / S / bandPt);
    for (let i = 0; i < bands; i += 1) {
      const y = Math.round(i * bandPt * S);
      const h = Math.min(Math.round(bandPt * S), common - y);
      const half = (img) => {
        const c = crop(img, 0, y, img.width, h);
        const w2 = Math.floor((c.width * 2) / 3);
        const h2 = Math.floor((c.height * 2) / 3);
        const out = blank(w2, h2);
        for (let py = 0; py < h2; py += 1) {
          for (let px = 0; px < w2; px += 1) {
            const sx = Math.min(c.width - 1, Math.round((px * 3) / 2));
            const sy = Math.min(c.height - 1, Math.round((py * 3) / 2));
            out.data.set(c.data.subarray((sy * c.width + sx) * 4, (sy * c.width + sx) * 4 + 4), (py * w2 + px) * 4);
          }
        }
        return out;
      };
      save(`zoom-${i + 1}.png`, row([half(viewMarked), half(appMarked)]));
    }
    // 3. Crops of failing elements at 3x with 4 pt of context.
    const cropDir = join(outDir, 'crops');
    rmSync(cropDir, { recursive: true, force: true });
    const ctx = 4 * S;
    const seen = new Set();
    for (const p of failing) {
      if (!p.testID || seen.has(p.testID)) continue;
      seen.add(p.testID);
      // The design side comes from the window this capture shows (view), at the problem's screen
      // rect, so a scrolled capture shows the same element on both sides. A state card is a
      // fragment, not a screen: its design side is cut at the fragment's own coordinates (the
      // problem's page rect), and the app side where the app draws the element (a text run: its
      // screen rect; anything else: its bounds).
      const isCard = layout.kind === 'state-card';
      const rr = isCard ? p.rect : (p.viewRect ?? toView(p.rect, p.testID));
      const ar = isCard
        ? (p.appRect ?? (p.rule === 'text-ink' ? p.viewRect : bounds.elements.get(p.testID)) ?? p.viewRect ?? rr)
        : (p.appRect ?? bounds.elements.get(p.testID) ?? rr);
      const w = Math.min(Math.round(rr.w * S) + 2 * ctx, 1400);
      const h = Math.min(Math.round(rr.h * S) + 2 * ctx, 1400);
      const dc = crop(view, Math.round(rr.x * S) - ctx, Math.round(rr.y * S) - ctx, w, h);
      const ac = crop(app, Math.round(ar.x * S) - ctx, Math.round(ar.y * S) - ctx, w, h);
      const dd = blank(w, h);
      pixelmatch(dc.data, ac.data, dd.data, w, h, { threshold: TOLERANCES.pixelmatchThreshold, alpha: 0.3, diffColor: [230, 30, 30], diffColorAlt: [30, 90, 230] });
      mkdirSync(cropDir, { recursive: true });
      save(`crops/${p.testID}.png`, row([dc, ac, dd]));
      report.note(`      crops/${p.testID}.png: design ${Math.round(rr.x)},${Math.round(rr.y)}${geo.tall ? ` of the window this capture shows (page y ${Math.round(p.rect.y)})` : ''} | app ${Math.round(ar.x)},${Math.round(ar.y)}`);
    }
    // 4. Eye-check contact sheet: icons, logos, pictures (checks include "crop"), design | app at 3x (capture scale).
    // Crop-only texts are judged by their ink (text-ink gate); the eye pages keep to pictures.
    const isInkOnly = (el) => isCropOnly(el) && (el.role === 'text' || el.role === 'header');
    const eyes = layout.elements.filter((el) => el.rect && el.checks?.includes('crop') && !isInkOnly(el) && !el.mask && el.rect.w * el.rect.h > 0);
    const pairs = [];
    const pairIds = [];
    // A crop-only part (inside an accessible element, or hidden from VoiceOver) is placed through
    // its cover: the cover's measured offset applied to the part's design box.
    const placed = (el) => {
      if (!isCropOnly(el)) return { a: bounds.elements.get(el.testID), key: el.testID };
      const coverId = el.coveredBy ?? el.parent;
      const cover = coverId ? layout.elements.find((c) => c.testID === coverId && c.rect) : null;
      const ca = coverId ? bounds.elements.get(coverId) : null;
      if (!cover || !ca) return { a: undefined, key: coverId };
      return { a: { x: el.rect.x + ca.x - cover.rect.x, y: el.rect.y + ca.y - cover.rect.y }, key: coverId };
    };
    for (const el of eyes) {
      const { a, key } = placed(el);
      if (!a) continue;
      // A tall frame's element partly hidden in this capture is paired in the capture that shows it whole.
      if (geo.tall && runReport && !(runReport.coverage ?? []).includes(key)) continue;
      pairIds.push(el.testID);
      const w = Math.min(Math.round(el.rect.w * S), 1100);
      const h = Math.min(Math.round(el.rect.h * S), 700);
      const shrink = (img) => downscale(img, 1);
      pairs.push(row([shrink(crop(design, Math.round(el.rect.x * S), Math.round(el.rect.y * S), w, h)), shrink(crop(app, Math.round(a.x * S), Math.round(a.y * S), w, h))]));
    }
    let page = 0;
    const eyePages = [];
    for (let i = 0; i < pairs.length; ) {
      const group = [];
      const ids = [];
      let height = 0;
      while (i < pairs.length && (group.length === 0 || height + pairs[i].height <= 2400)) {
        height += pairs[i].height;
        group.push(pairs[i]);
        ids.push(pairIds[i]);
        i += 1;
      }
      page += 1;
      save(`eye-${page}.png`, stack(group));
      eyePages.push({ file: `eye-${page}.png`, testIDs: ids });
      report.note(`      eye-${page}.png, top to bottom (design | app): ${ids.join(', ')}`);
    }
    writeFileSync(join(outDir, 'sheets.json'), `${JSON.stringify({ version: 1, frame: r.info.frame, theme: r.info.theme, lang: r.info.lang, game: r.info.game, reportSha256: runReport ? sha256(readFileSync(reportPath)) : null, files, eyePages }, null, 1)}\n`);
    made += 1;
    report.note(`sheet ${show(join(outDir, 'sheet.png'))}  (+ ${bands} zoom bands, ${seen.size} failing-element crops, ${page} eye-check page${page === 1 ? '' : 's'} for ${pairs.length} elements)`);
  }
  return report.finish({ checked: made || dirs.length, unit: 'runs' });
});
