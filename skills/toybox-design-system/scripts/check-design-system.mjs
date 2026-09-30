#!/usr/bin/env node
// check-design-system.mjs: proves an app repo implements the Toybox design system: the theme modules
// hold the exact token values, every game palette obeys the Toybox palette rules, every app bundles
// the Toybox fonts, and no runtime code uses blurred shadows, gradients, pills, raw font sizes,
// font weights, tracking or colour literals.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-design-system.mjs [repo-root]

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { REPO_SCAN_IGNORES, SHELL_DUE_TARGETS, createReporter, dueSkipReason, fail, lineOf, parseArgs, requireDir, run, walk } from './check-lib.mjs';
import { diffObject, importTsModule, inRanges, masked, readSource, sameValue, show, styleSheetRanges } from './lib/app-source.mjs';
import { schemeProblems } from './lib/palette-rules.mjs';
import {
  APP_FONT_FILES, COLOR_FIELDS, asRenderedBorder, expectedLogoTileVariants, expectedPalette, expectedScales,
  expectedShellColors, expectedTypeScale, expectedTypeStyles, loadTokens,
} from './lib/toybox-expectations.mjs';

const SPEC = {
  name: 'check-design-system',
  summary: 'Checks that the app repo implements Toybox: theme modules equal the token file, palettes pass the Toybox rules, apps bundle the fonts, and runtime code keeps the style bans.',
  usage: '[options] [repo-root]',
  options: {
    app: { type: 'string', multiple: true, value: 'game-id', help: 'Require this app\'s palette and fonts even if the folder looks unfinished' },
    'fonts-from': { type: 'string', value: 'dir', help: 'Reference font folder (default: this skill\'s assets/fonts)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  theme-file-missing     a Toybox theme or UI module is missing',
    '  theme-module-load      a theme module cannot be imported as plain data',
    '  color-tokens-fields    ColorTokens lacks one of the 16 Toybox fields',
    '  scale-mismatch         SPACING, LAYOUT, RADII, STROKE, ELEVATION, MIN_TOUCH, CONTENT_MAX_WIDTH',
    '  type-scale-mismatch    TYPE_SCALE differs from the Toybox roles',
    '  type-style-mismatch    TYPE_STYLES differs from the Toybox component text styles',
    '  shell-colors-mismatch  SHELL_COLORS differs from the Shell constants',
    '  motion-mismatch        EASING, MOTION_MS, RELEASE_SPRING or PRESS_SQUASH differ',
    '  font-family            FONT_FAMILIES differs from LilitaOne / Rubik-* / Vazirmatn-*',
    '  line-height-grid       a line height is not on the device pixel grid: use-localized-text-style.ts must set',
    '                         lineHeight: snapToPixels(...) (PixelRatio.get()), type-styles.ts must export',
    '                         snapToGrid (18.2 -> 55/3, 22.44 -> 67/3, 25.5 -> 77/3 at 3x), and no runtime file',
    '                         may round a lineHeight with Math.round/ceil/floor (React Native rounds text boxes up',
    '                         to whole pixels, so whole points and fractions both drift from the references)',
    '  no-glyph-nudge         AppText or use-localized-text-style.ts moves glyphs (translateY, top, padding or',
    '                         margin on the text); the CoreText vs Chrome offset is absorbed by the parity gate',
    '  sunk-by-layout         ui/raised-surface.tsx sinks a pushed-in key (chosen segment, disabled, busy, locked',
    '                         tile) with a transform instead of `top: elevation` on the Pressable: VoiceOver and',
    '                         Maestro report the layout frame, so the key\'s bounds sat 3 pt above the design\'s',
    '  logo-tile-mismatch     LOGO_TILE_VARIANTS in ui/logo-tile.tsx (typed-in literals) differ from the token',
    '                         file\'s components.logoTile (size, edge, ring, tilt, drop, cut edge per variant)',
    '  palette-missing / palette-shape / palette-mismatch / palette-colorblind / palette-hex /',
    '  palette-contrast / palette-fill / palette-one-ink / palette-shell-constant   (apps/<id>/src/theme/palette.ts)',
    '  font-files             an app lacks a Toybox font file, has a different file, or lacks a licence text',
    '  font-plugin            no expo-font plugin entry (Shell config or app.config.ts), or it misses one of the five TTFs;',
    '                         SKIP while packages/shell/src/config/shell-plugins.ts (the one plugin list, Shell',
    '                         build step 8) does not exist yet and no entry exists elsewhere',
    '  no-blur-shadow         shadowRadius/Opacity/Offset/Color or an elevation style key',
    '  no-gradient            gradient imports or Skia gradients in Shell UI',
    '  no-pill                a radius above 26, 999, 9999, 50% or size / 2',
    '  no-font-weight         fontWeight in app code (pick the weight\'s own family)',
    '  no-raw-font-size       fontSize literal in UI code (use AppText variants)',
    '  no-letter-spacing      letterSpacing literal in UI code',
    '  no-color-literal       hex or rgb() colour outside the theme, palette, board, art and Node-world config files',
    '',
    'Example: node check-design-system.mjs .   (from the app repo root)',
  ].join('\n'),
};

const SKILL_FONTS = fileURLToPath(new URL('../assets/fonts/', import.meta.url));
const SHELL = 'packages/shell/src';
const REQUIRED_FILES = [
  'theme/theme-types.ts', 'theme/tokens.ts', 'theme/type-styles.ts', 'theme/shell-colors.ts', 'theme/motion.ts',
  'theme/make-styles.ts', 'theme/theme-set.ts', 'theme/use-theme.ts', 'i18n/fonts.ts',
  'i18n/use-localized-text-style.ts', 'ui/app-text.tsx', 'ui/raised-surface.tsx', 'ui/toybox-styles.ts',
];
const TEXT_STYLE_FILE = `${SHELL}/i18n/use-localized-text-style.ts`;
const APP_TEXT_FILE = `${SHELL}/ui/app-text.tsx`;
const RAISED_SURFACE_FILE = `${SHELL}/ui/raised-surface.tsx`;
/** Toybox line heights at 3x: 14 x 1.3, 17 x 1.32, 17 x 1.5 (pinned by the type-style tests). */
const GRID_CASES = [[18.2, 55 / 3], [22.44, 67 / 3], [25.5, 77 / 3]];
const GRID_FIX = 'Copy use-localized-text-style.ts and type-styles.ts from the templates: lineHeight = snapToPixels(fontSize * ratio), never whole points and never the raw fraction.';
const LICENCES = {
  'Lilita One': ['LilitaOne-OFL.txt', 'OFL-LilitaOne.txt'],
  Rubik: ['Rubik-OFL.txt', 'OFL-Rubik.txt'],
  Vazirmatn: ['Vazirmatn-OFL.txt', 'OFL.txt'],
};
const FONT_FAMILIES = {
  display: 'LilitaOne', textRegular: 'Rubik-Regular', textBold: 'Rubik-Bold',
  arabicRegular: 'Vazirmatn-Regular', arabicBold: 'Vazirmatn-Bold',
};
const FIX_TEMPLATE = 'Copy the file from this skill\'s templates/ (it holds the Toybox values), then rerun.';

function checkThemeTypes(report, root) {
  const file = `${SHELL}/theme/theme-types.ts`;
  const source = readSource(join(root, file));
  if (source === null) return;
  const block = /export type ColorTokens = \{([\s\S]*?)\n\};/.exec(masked(source));
  const fields = new Set([...(block?.[1] ?? '').matchAll(/readonly (\w+)\??:/g)].map((m) => m[1]));
  const missing = COLOR_FIELDS.filter((field) => !fields.has(field));
  if (missing.length > 0) {
    report.problem({ file, line: 1, rule: 'color-tokens-fields', message: `ColorTokens lacks ${missing.join(', ')}`, fix: 'Add the Toybox fields (sunken, pop, onPop, shadow, focus ...) as in templates/packages/shell/src/theme/theme-types.ts.' });
  }
}

async function loadModule(report, root, rel) {
  const abs = join(root, SHELL, rel);
  if (!existsSync(abs)) return null;
  const { module, error } = await importTsModule(abs);
  if (error) report.problem({ file: `${SHELL}/${rel}`, line: 1, rule: 'theme-module-load', message: `cannot import as plain data: ${error}`, fix: 'Keep theme modules free of runtime imports (type imports only), as the templates are.' });
  return module ?? null;
}

function compareExport(report, { file, rule, name, actual, expected, fix }) {
  if (actual === undefined) {
    report.problem({ file, line: 1, rule, message: `${name} is not exported`, fix });
    return;
  }
  for (const diff of diffObject(actual, expected).slice(0, 12)) {
    report.problem({ file, line: 1, rule, message: `${name}.${diff.key} is ${show(diff.actual)}, Toybox says ${show(diff.expected)}`, fix });
  }
}

async function checkThemeModules(report, root, tokens) {
  const tokensModule = await loadModule(report, root, 'theme/tokens.ts');
  if (tokensModule) {
    const file = `${SHELL}/theme/tokens.ts`;
    for (const [name, expected] of Object.entries(expectedScales(tokens))) {
      if (typeof expected === 'number') {
        if (!sameValue(tokensModule[name], expected)) report.problem({ file, line: 1, rule: 'scale-mismatch', message: `${name} is ${show(tokensModule[name])}, Toybox says ${expected}`, fix: FIX_TEMPLATE });
      } else {
        const fix = name === 'STROKE' ? 'STROKE holds border widths as the references render them (Chrome floors a 2.5 border to 2): copy tokens.ts from the template.' : FIX_TEMPLATE;
        compareExport(report, { file, rule: 'scale-mismatch', name, actual: tokensModule[name], expected, fix });
      }
    }
    compareExport(report, { file, rule: 'type-scale-mismatch', name: 'TYPE_SCALE', actual: tokensModule.TYPE_SCALE, expected: expectedTypeScale(tokens), fix: FIX_TEMPLATE });
  }
  const styles = await loadModule(report, root, 'theme/type-styles.ts');
  if (styles) {
    compareExport(report, { file: `${SHELL}/theme/type-styles.ts`, rule: 'type-style-mismatch', name: 'TYPE_STYLES', actual: styles.TYPE_STYLES, expected: expectedTypeStyles(tokens), fix: FIX_TEMPLATE });
    checkGridFunction(report, styles);
  }
  const shell = await loadModule(report, root, 'theme/shell-colors.ts');
  if (shell) compareExport(report, { file: `${SHELL}/theme/shell-colors.ts`, rule: 'shell-colors-mismatch', name: 'SHELL_COLORS', actual: shell.SHELL_COLORS, expected: expectedShellColors(tokens), fix: FIX_TEMPLATE });
  const motion = await loadModule(report, root, 'theme/motion.ts');
  if (motion) checkMotion(report, motion, tokens);
  const fonts = await loadModule(report, root, 'i18n/fonts.ts');
  if (fonts) compareExport(report, { file: `${SHELL}/i18n/fonts.ts`, rule: 'font-family', name: 'FONT_FAMILIES', actual: fonts.FONT_FAMILIES, expected: FONT_FAMILIES, fix: FIX_TEMPLATE });
}

/** type-styles.ts exports snapToGrid, and it puts the Toybox line heights on the 3x pixel grid. */
function checkGridFunction(report, styles) {
  const file = `${SHELL}/theme/type-styles.ts`;
  if (typeof styles.snapToGrid !== 'function') {
    report.problem({ file, line: 1, rule: 'line-height-grid', message: 'type-styles.ts does not export snapToGrid(points, pixelRatio)', fix: GRID_FIX });
    return;
  }
  for (const [points, want] of GRID_CASES) {
    const got = styles.snapToGrid(points, 3);
    if (!sameValue(got, want)) report.problem({ file, line: 1, rule: 'line-height-grid', message: `snapToGrid(${points}, 3) is ${show(got)}, the 3x pixel grid says ${(want * 3).toFixed(0)}/3`, fix: GRID_FIX });
  }
}

/** The one text-style hook snaps line heights to pixels; neither it nor AppText nudges glyphs. */
function checkTextMetrics(report, root) {
  const hook = readSource(join(root, TEXT_STYLE_FILE));
  if (hook !== null) {
    const text = masked(hook);
    const line = lineOf(text, Math.max(0, text.search(/\blineHeight\s*:/)));
    if (!/\blineHeight\s*:\s*snapToPixels\s*\(/.test(text) || !/PixelRatio\.get\s*\(\s*\)/.test(text)) {
      report.problem({ file: TEXT_STYLE_FILE, line, rule: 'line-height-grid', message: 'the line height is not snapped to the device pixel grid (lineHeight: snapToPixels(...) with PixelRatio.get())', fix: GRID_FIX });
    }
  }
  for (const file of [TEXT_STYLE_FILE, APP_TEXT_FILE]) {
    const source = readSource(join(root, file));
    if (source === null) continue;
    scan(report, file, masked(source), 'no-glyph-nudge', /\b(translateY|top|paddingTop|paddingBottom|paddingBlock|paddingVertical|marginTop|marginBottom|marginBlock|marginVertical)\s*:/g, { message: (m) => `${m[1]} moves the text box to nudge its glyphs`, fix: 'Remove it: the box heights are exact on the pixel grid, and the remaining CoreText vs Chrome glyph offset is measured by the parity text-ink gate, not fixed in layout.' });
  }
}

/**
 * A key that stays pushed in moves by layout: `isSunk && { top: elevation }` on the Pressable. The
 * transform is only the transient press; Maestro, VoiceOver and the parity bounds ignore transforms.
 */
function checkSunkByLayout(report, root) {
  const source = readSource(join(root, RAISED_SURFACE_FILE));
  if (source === null) return;
  const text = masked(source);
  if (/\btop\s*:\s*elevation\b/.test(text)) return;
  const at = text.search(/\bisSunk\b/);
  report.problem({ file: RAISED_SURFACE_FILE, line: lineOf(text, Math.max(0, at)), rule: 'sunk-by-layout', message: 'a pushed-in key is sunk by a transform, so its layout frame (what Maestro, VoiceOver and the parity bounds measure) stays `elevation` above the design', fix: 'Give the Pressable style={[props.layoutStyle, isSunk && { top: elevation }]} and use translateY only for the transient press (copy raised-surface.tsx from the templates).' });
}

/** Reads a literal the logo tile table may hold: a number, a boolean or a STROKE token. */
function literalValue(text, tokens) {
  const value = text.trim();
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value === 'true' || value === 'false') return value === 'true';
  const stroke = /^STROKE\.(\w+)$/.exec(value);
  if (stroke && typeof tokens.stroke.scale[stroke[1]] === 'number') return asRenderedBorder(tokens.stroke.scale[stroke[1]]);
  return { unreadable: value };
}

/** The object literal after `export const LOGO_TILE_VARIANTS ... = {`, as { variant: { field: value } }. */
function readLogoTileVariants(source, tokens) {
  const text = masked(source);
  const head = /export const LOGO_TILE_VARIANTS\b[^=]*=\s*\{/.exec(text);
  if (!head) return null;
  let depth = 1;
  let end = head.index + head[0].length;
  for (; end < text.length && depth > 0; end += 1) {
    if (text[end] === '{') depth += 1;
    else if (text[end] === '}') depth -= 1;
  }
  const body = text.slice(head.index + head[0].length, end - 1);
  const variants = {};
  for (const entry of body.matchAll(/(\w+)\s*:\s*\{([^{}]*)\}/g)) {
    const fields = {};
    for (const field of entry[2].matchAll(/(\w+)\s*:\s*([^,]+)/g)) fields[field[1]] = literalValue(field[2], tokens);
    variants[entry[1]] = fields;
  }
  return { variants, line: lineOf(text, head.index) };
}

/** The logo tile keeps its sizes as typed-in literals; they must still equal the token file. */
function checkLogoTile(report, root, tokens) {
  const file = `${SHELL}/ui/logo-tile.tsx`;
  const source = readSource(join(root, file));
  if (source === null) return false;
  const found = readLogoTileVariants(source, tokens);
  const fix = 'Copy the value from the token file\'s components.logoTile (references/layout-shape-tokens.md, "Logo tile"); never retype a different number.';
  if (found === null) {
    report.problem({ file, line: 1, rule: 'logo-tile-mismatch', message: 'no `export const LOGO_TILE_VARIANTS = { ... }` table', fix });
    return true;
  }
  const expected = expectedLogoTileVariants(tokens);
  for (const name of new Set([...Object.keys(expected), ...Object.keys(found.variants)])) {
    const want = expected[name];
    const have = found.variants[name];
    if (want === undefined || have === undefined) {
      report.problem({ file, line: found.line, rule: 'logo-tile-mismatch', message: want === undefined ? `variant ${name} is not a Toybox logo tile` : `variant ${name} is missing`, fix });
      continue;
    }
    for (const [key, value] of Object.entries(want)) {
      if (!sameValue(have[key], value)) report.problem({ file, line: found.line, rule: 'logo-tile-mismatch', message: `LOGO_TILE_VARIANTS.${name}.${key} is ${show(have[key])}, Toybox says ${show(value)}`, fix });
    }
  }
  return true;
}

function checkMotion(report, motion, tokens) {
  const file = `${SHELL}/theme/motion.ts`;
  const m = tokens.motion;
  const press = tokens.press;
  const expectedMs = { ...m.duration, winTitleStickerDelay: m.delays.winTitleSticker, newBestStickerDelay: m.delays.newBestSticker };
  const expected = {
    EASING: m.easing,
    RELEASE_SPRING: m.springs.release,
    PRESS_SQUASH: {
      button: { x: press.button.scaleX - 1, y: press.button.scaleY - 1 },
      iconButton: { x: press.iconButton.scaleX - 1, y: press.iconButton.scaleY - 1 },
      levelTile: { x: press.levelTile.scaleX - 1, y: press.levelTile.scaleY - 1 },
      quietButtonScale: press.quietButton.scale,
    },
  };
  for (const [name, value] of Object.entries(expected)) compareExport(report, { file, rule: 'motion-mismatch', name, actual: motion[name], expected: value, fix: FIX_TEMPLATE });
  for (const [key, value] of Object.entries(expectedMs)) {
    if (!sameValue(motion.MOTION_MS?.[key], value)) report.problem({ file, line: 1, rule: 'motion-mismatch', message: `MOTION_MS.${key} is ${show(motion.MOTION_MS?.[key])}, Toybox says ${value}`, fix: FIX_TEMPLATE });
  }
}

function appFolders(root, required) {
  const appsDir = join(root, 'apps');
  const found = existsSync(appsDir) ? readdirSync(appsDir).filter((name) => statSync(join(appsDir, name)).isDirectory()) : [];
  for (const id of required) if (!found.includes(id)) found.push(id);
  return found.sort();
}

async function checkPalette(report, root, id, tokens) {
  const file = `apps/${id}/src/theme/palette.ts`;
  const abs = join(root, file);
  if (!existsSync(abs)) {
    report.problem({ file, rule: 'palette-missing', message: `app ${id} has no Toybox palette`, fix: `Run: node \${CLAUDE_SKILL_DIR}/scripts/write-palette.mjs --game ${id}` });
    return;
  }
  const { module, error } = await importTsModule(abs);
  const palette = module?.PALETTE;
  if (error || !palette?.standard?.light || !palette?.standard?.dark || !palette?.colorBlind) {
    report.problem({ file, line: 1, rule: 'palette-shape', message: error ? `cannot import: ${error}` : 'PALETTE must export { standard: { light, dark }, colorBlind: { light, dark } }', fix: 'Regenerate it with write-palette.mjs (type imports only, plain objects).' });
    return;
  }
  for (const scheme of ['light', 'dark']) {
    if (palette.colorBlind[scheme] !== palette.standard[scheme]) {
      report.problem({ file, line: 1, rule: 'palette-colorblind', message: `colorBlind.${scheme} is not the same object as standard.${scheme}`, fix: 'Write colorBlind: { light: LIGHT, dark: DARK }: Toybox carries meaning by shape, not hue.' });
    }
    for (const problem of schemeProblems(scheme, palette.standard[scheme], COLOR_FIELDS, tokens)) {
      report.problem({ file, line: 1, rule: problem.rule, message: problem.message, fix: 'Fix the paint (references/colour-tokens.md) and regenerate with write-palette.mjs.' });
    }
  }
  const expected = expectedPalette(tokens, id);
  if (!expected) return;
  for (const scheme of ['light', 'dark']) {
    for (const diff of diffObject(palette.standard[scheme], expected[scheme])) {
      report.problem({ file, line: 1, rule: 'palette-mismatch', message: `${scheme}.${diff.key} is ${show(diff.actual)}, the Toybox paint is ${show(diff.expected)}`, fix: `Run: node \${CLAUDE_SKILL_DIR}/scripts/write-palette.mjs --game ${id} --force` });
    }
  }
}

function sha(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function checkFonts(report, root, id, fontsFrom) {
  const dir = `apps/${id}/assets/fonts`;
  for (const name of APP_FONT_FILES) {
    const ref = join(fontsFrom, name);
    const abs = join(root, dir, name);
    if (!existsSync(ref)) fail(`reference font ${ref} is missing`, 'Run skills/_library/sync-shared.mjs, or pass --fonts-from <dir>.');
    if (!existsSync(abs)) report.problem({ file: `${dir}/${name}`, rule: 'font-files', message: 'Toybox font file is missing', fix: 'Copy it from this skill\'s assets/fonts/ (byte for byte).' });
    else if (sha(abs) !== sha(ref)) report.problem({ file: `${dir}/${name}`, rule: 'font-files', message: 'font file differs from the Toybox font (sha256)', fix: 'Replace it with the file from this skill\'s assets/fonts/.' });
  }
  for (const [family, names] of Object.entries(LICENCES)) {
    if (!names.some((name) => existsSync(join(root, dir, name)))) {
      report.problem({ file: dir, rule: 'font-files', message: `no licence text for ${family} (${names.join(' or ')})`, fix: `Copy ${names[0]} from this skill's assets/fonts/.` });
    }
  }
}

/**
 * Every Expo app must embed the five fonts through one `expo-font` plugin entry (Shell config or app
 * config). The entry lives in the one plugin list, shell-plugins.ts, which the Shell build creates at
 * step 8 (before the first simulator build); until that file exists a missing entry is not yet due.
 */
function checkFontPlugin(report, root, expoApps) {
  if (expoApps.length === 0) return;
  const configDir = `${SHELL}/config`;
  const candidates = existsSync(join(root, configDir))
    ? walk(join(root, configDir), { include: ['*.ts'], ignore: ['*.test.ts'] }).map((rel) => `${configDir}/${rel}`)
    : [];
  for (const id of expoApps) if (existsSync(join(root, 'apps', id, 'app.config.ts'))) candidates.push(`apps/${id}/app.config.ts`);
  const withPlugin = candidates.filter((file) => /['"]expo-font['"]/.test(masked(readFileSync(join(root, file), 'utf8'))));
  if (withPlugin.length === 0) {
    const pluginList = SHELL_DUE_TARGETS.plugins.file;
    const notYetDue = dueSkipReason(root, SHELL_DUE_TARGETS.plugins);
    if (notYetDue !== null) {
      report.skip({ file: pluginList, rule: 'font-plugin', message: notYetDue });
      return;
    }
    report.problem({ file: pluginList, rule: 'font-plugin', message: 'no expo-font plugin entry embeds the Toybox fonts, so every screen falls back to the system font', fix: `Add ['expo-font', { fonts: [${APP_FONT_FILES.map((name) => `'./assets/fonts/${name}'`).join(', ')}] }] to the one plugin list (references/type-and-fonts.md).` });
    return;
  }
  for (const file of withPlugin) {
    const text = masked(readFileSync(join(root, file), 'utf8'));
    const missing = APP_FONT_FILES.filter((name) => !text.includes(`/${name}`) && !text.includes(`'${name}'`));
    if (missing.length > 0) {
      report.problem({ file, line: lineOf(text, text.search(/['"]expo-font['"]/)), rule: 'font-plugin', message: `the expo-font entry does not embed ${missing.join(', ')}`, fix: `List all five: ${APP_FONT_FILES.map((name) => `./assets/fonts/${name}`).join(', ')}.` });
    }
  }
}

const RUNTIME_EXCLUDES = ['*.test.ts', '*.test.tsx', '*.d.ts', 'testing', '__generated__'];
const UI_SCOPES = /^(packages\/shell\/src\/(ui|screens|app)\/|apps\/[^/]+\/src\/(ui|screens)\/)/;
const COLOR_ALLOWED = /^(packages\/shell\/src\/(theme|ui\/icons|art|testing|config)\/|apps\/[^/]+\/src\/(theme|board|art)\/)/;
const SHELL_UI = /^packages\/shell\/src\/(ui|screens|app)\//;

/** Shell and app runtime sources; the skill library, native projects and Pods are never walked. */
function runtimeFiles(root) {
  return walk(root, { include: ['*.ts', '*.tsx'], ignore: [...REPO_SCAN_IGNORES, ...RUNTIME_EXCLUDES] })
    .filter((path) => path.startsWith(`${SHELL}/`) || /^apps\/[^/]+\/src\//.test(path));
}

function scan(report, file, text, rule, pattern, { message, fix, when = () => true }) {
  for (const match of text.matchAll(pattern)) {
    if (when(match)) report.problem({ file, line: lineOf(text, match.index), rule, message: message(match), fix });
  }
}

function radiusIsPill(value) {
  const v = value.trim();
  if (/\/\s*2\b/.test(v) || /['"]\s*50%\s*['"]/.test(v)) return true;
  const n = /^(\d+(?:\.\d+)?)$/.exec(v);
  return n !== null && Number(n[1]) > 26;
}

function checkStyles(report, file, source) {
  const text = masked(source);
  const sheets = styleSheetRanges(text);
  scan(report, file, text, 'no-blur-shadow', /\b(shadowRadius|shadowOpacity|shadowOffset|shadowColor)\s*:/g, { message: (m) => `${m[1]} draws a blurred shadow`, fix: 'Raised controls use RaisedSurface; static parts use hardShadow(offset, color).' });
  scan(report, file, text, 'no-blur-shadow', /\belevation\s*:/g, { when: (m) => inRanges(m.index, sheets), message: () => 'the Android elevation style key blurs', fix: 'Use RaisedSurface or hardShadow(); ELEVATION values are offsets, not style keys.' });
  scan(report, file, text, 'no-gradient', /from\s+['"](expo-linear-gradient|react-native-linear-gradient)['"]/g, { message: (m) => `${m[1]} paints a gradient`, fix: 'Toybox paints are flat: use one theme colour.' });
  if (SHELL_UI.test(file)) scan(report, file, text, 'no-gradient', /\b(LinearGradient|RadialGradient|SweepGradient|TwoPointConicalGradient)\b/g, { message: (m) => `${m[1]} in Shell UI`, fix: 'Toybox paints are flat: use one theme colour.' });
  scan(report, file, text, 'no-pill', /\bborder\w*Radius\s*:\s*([^,}\n]+)/g, { when: (m) => radiusIsPill(m[1]), message: (m) => `radius ${m[1].trim()} makes a pill or a circle`, fix: 'Use RADII (6/10/14/22) or the component radius; the largest control radius is 14.' });
  scan(report, file, text, 'line-height-grid', /\blineHeight\s*:\s*Math\.(round|ceil|floor)\s*\(/g, { message: (m) => `lineHeight uses Math.${m[1]}, so the text box leaves the pixel grid`, fix: GRID_FIX });
  scan(report, file, text, 'no-font-weight', /\bfontWeight\s*:/g, { message: () => 'fontWeight with a custom family picks a fake weight', fix: 'Use AppText variants; fonts.ts picks Rubik-Bold / Vazirmatn-Bold by family.' });
  if (UI_SCOPES.test(file)) {
    scan(report, file, text, 'no-raw-font-size', /\bfontSize\s*:\s*\d/g, { message: () => 'raw font size in UI code', fix: 'Use <AppText variant="..."> with a Toybox role or component style.' });
    scan(report, file, text, 'no-letter-spacing', /\bletterSpacing\s*:\s*-?\d/g, { message: () => 'letter-spacing literal in UI code', fix: 'Toybox tracks only the game name (gameName* styles); remove it.' });
  }
  if (!COLOR_ALLOWED.test(file)) {
    scan(report, file, text, 'no-color-literal', /(['"`])(#[0-9A-Fa-f]{3,8}|rgba?\([^'"`]*\))\1/g, { message: (m) => `colour literal ${m[2]}`, fix: 'Take it from theme.colors or SHELL_COLORS[theme.scheme].' });
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'app repo root');
  if (!existsSync(join(root, SHELL))) fail(`nothing to check: ${join(root, SHELL)} does not exist`, 'Run from the app repo root (the folder with packages/shell), or pass it as the argument.');
  const fontsFrom = options['fonts-from'] ? requireDir(options['fonts-from'], 'font folder') : SKILL_FONTS;
  const tokens = loadTokens();
  const report = createReporter({ name: 'check-design-system', json: options.json });
  let checked = 0;
  for (const rel of REQUIRED_FILES) {
    checked += 1;
    if (!existsSync(join(root, SHELL, rel))) report.problem({ file: `${SHELL}/${rel}`, rule: 'theme-file-missing', message: 'Toybox module is missing', fix: FIX_TEMPLATE });
  }
  checkThemeTypes(report, root);
  await checkThemeModules(report, root, tokens);
  checkTextMetrics(report, root);
  checkSunkByLayout(report, root);
  if (checkLogoTile(report, root, tokens)) checked += 1;
  const expoApps = [];
  for (const id of appFolders(root, options.app)) {
    const appDir = join(root, 'apps', id);
    const isRequired = options.app.includes(id);
    const hasSource = existsSync(join(appDir, 'src'));
    const isExpoApp = existsSync(join(appDir, 'app.config.ts')) || existsSync(join(appDir, 'app.json'));
    if (isExpoApp) expoApps.push(id);
    if (isRequired || hasSource) await checkPalette(report, root, id, tokens);
    if (isRequired || isExpoApp) checkFonts(report, root, id, fontsFrom);
    checked += 1;
  }
  checkFontPlugin(report, root, expoApps);
  for (const file of runtimeFiles(root)) {
    checked += 1;
    checkStyles(report, file, readFileSync(join(root, file), 'utf8'));
  }
  return report.finish({ checked, unit: 'files and apps' });
});
