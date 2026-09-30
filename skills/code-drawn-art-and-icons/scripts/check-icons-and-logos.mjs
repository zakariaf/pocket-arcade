#!/usr/bin/env node
// check-icons-and-logos.mjs: proves the app repo's code-drawn art is intact: the Shell icon set
// (icon-paths.ts and its icon-layers.json source) holds the 41 Toybox icons and the rating-star
// layers, each path is valid, on the 24 grid and in step with its layers; every game has a valid
// 48-grid logo; and nothing draws UI with image files, emoji, icon fonts or react-native-svg.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-icons-and-logos.mjs [repo-root]

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, fail, lineOf, maskComments, parseArgs, requireDir, run, walk } from './check-lib.mjs';
import { DIRECTIONAL, LOGO_ROLES, expectedGlyphs, expectedLogos, importTsModule, loadTokens, sameValue } from './lib/art-expectations.mjs';
import { compareIconCoverage } from './lib/icon-coverage.mjs';
import { pathBounds } from './lib/svg-path.mjs';

const SPEC = {
  name: 'check-icons-and-logos',
  summary: 'Checks the Shell icon set, every game logo and the drawn-in-code bans in an app repo.',
  usage: '[options] [repo-root]',
  options: { json: { type: 'boolean', help: 'Also print the problems as one JSON line' } },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  icon-paths-missing   packages/shell/src/ui/icons/icon-paths.ts is missing',
    '  icon-module-load     icon-paths.ts or logo-art.ts cannot be imported as plain data',
    '  icon-set             a Toybox icon (or rating-star layer) is missing, or an icon has no source layers',
    '  icon-directional     of the Toybox icons, DIRECTIONAL_ICONS is not exactly back, chevron, forward, undo',
    '  icon-path-syntax     an icon path is not valid SVG path data',
    '  icon-path-grid       an icon path leaves the 24-unit grid',
    '  icon-path-stale      an icon path does not match its layers: box or sampled coverage (regenerate with build-icon-paths.ts)',
    '  icon-layers-missing  packages/tooling/src/art/icon-layers.json is missing',
    '  icon-layers-drift    a Toybox icon\'s layers differ from the Toybox icon data',
    '  logo-missing         an app with src/ has no src/art/logo-art.ts',
    '  logo-shape           LOGO_ART is empty, uses an unknown role, bad path data or leaves the 48 grid',
    '  logo-mismatch        a painted game\'s logo differs from its Toybox logo',
    '  game-art             an assembled game (src/index.ts) has no src/art/game-art.ts, or GAME_ART.logo is not its LOGO_ART',
    '  logo-tile-tokens     LOGO_TILE_VARIANTS in logo-tile.tsx differs from the Toybox logo tile tokens',
    '  no-svg-library       react-native-svg or an icon font package is imported',
    '  no-emoji             an emoji in app source or catalog text',
    '  no-image-file        an image file in src/ or an image import (art is drawn in code)',
    '  icon-raster-mock     packages/shell/src/ui/icons/icon-raster.ts exists but the root jest.setup.ts does not',
    '                       mock it (Skia cannot load in the unit project, so every test that renders an Icon fails)',
  ].join('\n'),
};

const SHELL = 'packages/shell/src';
const LOGO_TILE_FILE = `${SHELL}/ui/logo-tile.tsx`;
/** The numbers of each LogoTile variant in the file, in the order the tokens give them. */
const TILE_FIELDS = ['size', 'edgeWidth', 'ring', 'rotateDeg', 'translateY'];
const PATHS_FILE = `${SHELL}/ui/icons/icon-paths.ts`;
const LAYERS_FILE = 'packages/tooling/src/art/icon-layers.json';
const GRID_MARGIN = 0.5;
const STALE_TOLERANCE = 0.2;
const REGENERATE = 'Run: node packages/tooling/src/art/build-icon-paths.ts (from the repo root), then rerun.';
const BANNED_PACKAGES = /from\s+['"](react-native-svg|react-native-vector-icons[^'"]*|@expo\/vector-icons[^'"]*|expo-symbols|react-native-sfsymbols)['"]/g;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|heic)$/i;
// Extended_Pictographic without the three text marks that legal notices use.
const EMOJI = /(?![©®™])\p{Extended_Pictographic}/u;

function layersBox(layers) {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const layer of layers) {
    const b = pathBounds(layer.d);
    const w = layer.op === 'stroke' ? layer.width / 2 : 0;
    box.minX = Math.min(box.minX, b.minX - w);
    box.minY = Math.min(box.minY, b.minY - w);
    box.maxX = Math.max(box.maxX, b.maxX + w);
    box.maxY = Math.max(box.maxY, b.maxY + w);
  }
  return box;
}

function checkLayersFile(report, root, expected) {
  const abs = join(root, LAYERS_FILE);
  if (!existsSync(abs)) {
    report.problem({ file: LAYERS_FILE, rule: 'icon-layers-missing', message: 'the icon source layers are missing', fix: 'Copy templates/packages/tooling/src/art/icon-layers.json from this skill.' });
    return null;
  }
  let data;
  try {
    data = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (error) {
    report.problem({ file: LAYERS_FILE, line: 1, rule: 'icon-layers-drift', message: `not valid JSON: ${error.message}`, fix: 'Copy the file from this skill again.' });
    return null;
  }
  for (const [name, layers] of Object.entries(expected)) {
    if (!sameValue(data.glyphs?.[name]?.layers, layers)) {
      report.problem({ file: LAYERS_FILE, line: 1, rule: 'icon-layers-drift', message: `layers of "${name}" differ from the Toybox icon data`, fix: 'Restore them from this skill\'s templates/packages/tooling/src/art/icon-layers.json.' });
    }
  }
  return data;
}

function checkPath(report, name, d, layers) {
  let box;
  try {
    box = pathBounds(d);
  } catch (error) {
    report.problem({ file: PATHS_FILE, line: 1, rule: 'icon-path-syntax', message: `"${name}": ${error.message}`, fix: REGENERATE });
    return;
  }
  if (box.minX < -GRID_MARGIN || box.minY < -GRID_MARGIN || box.maxX > 24 + GRID_MARGIN || box.maxY > 24 + GRID_MARGIN) {
    report.problem({ file: PATHS_FILE, line: 1, rule: 'icon-path-grid', message: `"${name}" spans ${box.minX.toFixed(1)},${box.minY.toFixed(1)} to ${box.maxX.toFixed(1)},${box.maxY.toFixed(1)}, outside the 24 grid`, fix: 'Redraw the icon layers inside 0..24, then regenerate.' });
  }
  if (!layers) return;
  const want = layersBox(layers);
  const off = Math.max(Math.abs(box.minX - want.minX), Math.abs(box.minY - want.minY), Math.abs(box.maxX - want.maxX), Math.abs(box.maxY - want.maxY));
  if (off > STALE_TOLERANCE) {
    report.problem({ file: PATHS_FILE, line: 1, rule: 'icon-path-stale', message: `"${name}" is ${off.toFixed(2)} units off its layers (a stale or swapped path)`, fix: REGENERATE });
    return;
  }
  // Same box is not the same shape: sample both on a grid and compare what they cover.
  const { mismatched, judged, example } = compareIconCoverage(d, layers);
  if (mismatched > 0) {
    const where = `${example.x},${example.y} is ${example.generated ? 'drawn but not in the layers' : 'in the layers but not drawn'}`;
    report.problem({ file: PATHS_FILE, line: 1, rule: 'icon-path-stale', message: `"${name}" covers ${mismatched} of ${judged} sample points differently from its layers (${where})`, fix: REGENERATE });
  }
}

async function checkIcons(report, root, tokens) {
  const expected = expectedGlyphs(tokens);
  const layersData = checkLayersFile(report, root, expected);
  const abs = join(root, PATHS_FILE);
  if (!existsSync(abs)) {
    report.problem({ file: PATHS_FILE, rule: 'icon-paths-missing', message: 'the generated icon paths are missing', fix: `Copy templates/${PATHS_FILE} from this skill, or regenerate: ${REGENERATE}` });
    return;
  }
  const { module, error } = await importTsModule(abs);
  if (error || !module?.ICON_PATHS) {
    report.problem({ file: PATHS_FILE, line: 1, rule: 'icon-module-load', message: error ?? 'ICON_PATHS is not exported', fix: REGENERATE });
    return;
  }
  const names = Object.keys(module.ICON_PATHS);
  for (const name of Object.keys(expected)) {
    if (!names.includes(name)) report.problem({ file: PATHS_FILE, line: 1, rule: 'icon-set', message: `icon "${name}" is missing`, fix: REGENERATE });
  }
  for (const name of names) {
    const layers = layersData?.glyphs?.[name]?.layers;
    if (layersData && !layers) report.problem({ file: PATHS_FILE, line: 1, rule: 'icon-set', message: `icon "${name}" has no layers in ${LAYERS_FILE}`, fix: 'Add its layers to icon-layers.json (references/icon-system.md, "Adding an icon"), then regenerate.' });
    checkPath(report, name, module.ICON_PATHS[name], layers);
  }
  // The four Toybox arrows mirror and no other Toybox icon does; a new app-specific arrow may be added.
  const directional = module.DIRECTIONAL_ICONS ? [...module.DIRECTIONAL_ICONS].sort() : [];
  const toyboxDirectional = directional.filter((name) => name in expected);
  if (!sameValue(toyboxDirectional, DIRECTIONAL)) {
    report.problem({ file: PATHS_FILE, line: 1, rule: 'icon-directional', message: `DIRECTIONAL_ICONS holds the Toybox icons [${toyboxDirectional.join(', ')}]`, fix: 'Of the Toybox icons only back, chevron, forward and undo mirror in RTL; fix "directional" in icon-layers.json and regenerate.' });
  }
}

function checkLogoLayers(report, file, layers) {
  if (!Array.isArray(layers) || layers.length === 0) {
    report.problem({ file, line: 1, rule: 'logo-shape', message: 'LOGO_ART.layers is empty or missing', fix: 'Export LOGO_ART: LogoArt with at least one layer (references/logos-and-pictures.md).' });
    return;
  }
  layers.forEach((layer, index) => {
    if (!LOGO_ROLES.includes(layer.role)) report.problem({ file, line: 1, rule: 'logo-shape', message: `layer ${index} has role "${layer.role}"`, fix: `Use one of ${LOGO_ROLES.join(', ')}.` });
    try {
      const box = pathBounds(layer.d);
      if (box.minX < -1 || box.minY < -1 || box.maxX > 49 || box.maxY > 49) report.problem({ file, line: 1, rule: 'logo-shape', message: `layer ${index} leaves the 48 grid`, fix: 'Draw logos inside 0..48 (the tile shows 88 % of it).' });
    } catch (error) {
      report.problem({ file, line: 1, rule: 'logo-shape', message: `layer ${index}: ${error.message}`, fix: 'Fix the SVG path data.' });
    }
  });
}

async function checkLogos(report, root, tokens) {
  const logos = expectedLogos(tokens);
  const appsDir = join(root, 'apps');
  if (!existsSync(appsDir)) return 0;
  let count = 0;
  for (const id of readdirSync(appsDir).filter((name) => existsSync(join(appsDir, name, 'src')) && statSync(join(appsDir, name)).isDirectory())) {
    count += 1;
    const file = `apps/${id}/src/art/logo-art.ts`;
    if (!existsSync(join(root, file))) {
      report.problem({ file, rule: 'logo-missing', message: `game ${id} has no logo`, fix: 'Draw its LOGO_ART on the 48 grid (references/logos-and-pictures.md, "Designing a new logo").' });
      continue;
    }
    const { module, error } = await importTsModule(join(root, file));
    if (error) {
      report.problem({ file, line: 1, rule: 'icon-module-load', message: error, fix: 'Keep logo-art.ts plain data with type imports only.' });
      continue;
    }
    checkGameArt(report, root, id);
    const layers = module.LOGO_ART?.layers;
    checkLogoLayers(report, file, layers);
    if (logos[id] && !sameValue(layers, logos[id])) {
      report.problem({ file, line: 1, rule: 'logo-mismatch', message: `the ${id} logo differs from its Toybox logo`, fix: `Copy it from this skill (templates or examples ${id}-logo-art.ts).` });
    }
  }
  return count;
}

/** GAME_ART.logo is the game's own LOGO_ART, so the result and Home tiles match the app icon. */
function checkGameArt(report, root, id) {
  const file = `apps/${id}/src/art/game-art.ts`;
  const isAssembled = existsSync(join(root, 'apps', id, 'src', 'index.ts'));
  if (!existsSync(join(root, file))) {
    if (isAssembled) report.problem({ file, rule: 'game-art', message: `game ${id} is assembled but has no GAME_ART`, fix: 'Copy templates/apps/__GAME_ID__/src/art/game-art.ts (palettes, logo: LOGO_ART, credits) and fill __GAME_ID__.' });
    return;
  }
  const text = maskComments(readFileSync(join(root, file), 'utf8'));
  const importsLogo = /import\s*\{[^}]*\bLOGO_ART\b[^}]*\}\s*from\s*['"](\.\/logo-art\.ts|@e07\/[a-z0-9-]+\/art\/logo-art\.ts)['"]/.test(text);
  if (!importsLogo || !/\blogo\s*:\s*LOGO_ART\b/.test(text)) {
    const at = /\blogo\s*:/.exec(text);
    report.problem({ file, line: at ? lineOf(text, at.index) : 1, rule: 'game-art', message: 'GAME_ART.logo is not the game\'s LOGO_ART from ./logo-art.ts', fix: "import { LOGO_ART } from './logo-art.ts'; and set logo: LOGO_ART, so every picture of the game is the one logo." });
  }
}

/** Expected LogoTile numbers per variant, from the Toybox tokens. */
function tileTokens(tokens) {
  const tile = tokens.components.logoTile;
  const bold = tokens.stroke.scale.bold;
  return Object.fromEntries(Object.entries(tile.sizes).map(([variant, size]) => {
    const own = tile[variant] ?? {};
    const edge = typeof own.border === 'number' ? own.border : tile.border;
    return [variant, { size, edgeWidth: edge === bold ? 'STROKE.bold' : edge, ring: own.ring ?? 0, rotateDeg: own.rotate ?? tile.rotate, translateY: own.translateY ?? 0 }];
  }));
}

/** LOGO_TILE_VARIANTS holds typed-in numbers; they must stay the Toybox logo tile tokens. */
function checkLogoTile(report, root, tokens) {
  const abs = join(root, LOGO_TILE_FILE);
  if (!existsSync(abs)) return;
  const text = maskComments(readFileSync(abs, 'utf8'));
  const start = text.search(/\bLOGO_TILE_VARIANTS\b[^=]*=\s*\{/);
  if (start < 0) {
    report.problem({ file: LOGO_TILE_FILE, line: 1, rule: 'logo-tile-tokens', message: 'LOGO_TILE_VARIANTS is missing', fix: `Copy templates/${LOGO_TILE_FILE} from this skill.` });
    return;
  }
  for (const [variant, want] of Object.entries(tileTokens(tokens))) {
    const match = new RegExp(`\\b${variant}\\s*:\\s*\\{([^}]*)\\}`).exec(text.slice(start));
    const line = match ? lineOf(text, start + match.index) : lineOf(text, start);
    const fields = Object.fromEntries([...(match?.[1] ?? '').matchAll(/(\w+)\s*:\s*([^,\n]+)/g)].map((m) => [m[1], m[2].trim()]));
    for (const field of TILE_FIELDS) {
      const have = fields[field];
      if (have === undefined || have !== String(want[field])) report.problem({ file: LOGO_TILE_FILE, line, rule: 'logo-tile-tokens', message: `${variant}.${field} is ${have ?? 'missing'}, the Toybox tokens say ${want[field]}`, fix: 'Set it to the token value (components.logoTile in the Toybox tokens); the tile is part of the design, not a free choice.' });
    }
  }
}

function checkSources(report, root) {
  let count = 0;
  for (const base of [SHELL, 'apps']) {
    if (!existsSync(join(root, base))) continue;
    for (const rel of walk(join(root, base), { ignore: ['__image_snapshots__', '*.test.ts', '*.test.tsx', 'fixtures', 'assets', 'ios', 'android', 'build'] })) {
      const file = `${base}/${rel}`;
      if (base === 'apps' && !/^apps\/[^/]+\/src\//.test(file)) continue;
      count += 1;
      if (IMAGE_EXT.test(rel)) {
        report.problem({ file, rule: 'no-image-file', message: 'image file in app source', fix: 'Draw it in code (icon layers, logo layers or a picture op); app icons go to assets/generated via render-art.ts.' });
        continue;
      }
      if (!/\.(tsx?|json)$/.test(rel)) continue;
      const source = readFileSync(join(root, file), 'utf8');
      const text = rel.endsWith('.json') ? source : maskComments(source);
      for (const match of text.matchAll(BANNED_PACKAGES)) report.problem({ file, line: lineOf(text, match.index), rule: 'no-svg-library', message: `${match[1]} draws icons outside the Toybox set`, fix: 'Use <Icon name="..."> (Skia paths rasterized once).' });
      for (const match of text.matchAll(/(?:require\(\s*|from\s+)['"][^'"]+\.(png|jpe?g|gif|webp|svg)['"]/g)) report.problem({ file, line: lineOf(text, match.index), rule: 'no-image-file', message: 'image import in app source', fix: 'Draw it in code; only the generated app icon and splash PNGs exist, and the Expo config names them.' });
      const emoji = EMOJI.exec(text);
      if (emoji) report.problem({ file, line: lineOf(text, emoji.index), rule: 'no-emoji', message: `emoji "${emoji[0]}"`, fix: 'Toybox uses its 24-unit icons, never emoji: pick an Icon or remove it.' });
    }
  }
  return count;
}

const RASTER_FILE = `${SHELL}/ui/icons/icon-raster.ts`;
const JEST_SETUP = 'jest.setup.ts';
const RASTER_MOCK = /jest\.mock\(\s*['"]@e07\/shell\/ui\/icons\/icon-raster\.ts['"]/;

/** Once icon-raster.ts exists, the root jest.setup.ts must mock it (its line ships commented out). */
function checkRasterMock(report, root) {
  if (!existsSync(join(root, RASTER_FILE)) || !existsSync(join(root, JEST_SETUP))) return;
  const setup = maskComments(readFileSync(join(root, JEST_SETUP), 'utf8'));
  if (!RASTER_MOCK.test(setup)) {
    report.problem({ file: JEST_SETUP, line: 1, rule: 'icon-raster-mock', message: 'icon-raster.ts exists but jest.setup.ts does not mock it', fix: "Uncomment the jest.mock('@e07/shell/ui/icons/icon-raster.ts', ...) lines in jest.setup.ts (workflow step 2): the unit project cannot load Skia, so every test that renders an Icon would fail." });
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'app repo root');
  if (!existsSync(join(root, SHELL))) fail(`nothing to check: ${join(root, SHELL)} does not exist`, 'Run from the app repo root (the folder with packages/shell), or pass it as the argument.');
  const tokens = loadTokens();
  const report = createReporter({ name: 'check-icons-and-logos', json: options.json });
  await checkIcons(report, root, tokens);
  const apps = await checkLogos(report, root, tokens);
  checkLogoTile(report, root, tokens);
  const files = checkSources(report, root);
  checkRasterMock(report, root);
  return report.finish({ checked: files + apps + 1, unit: 'files, apps and icon sets' });
});
