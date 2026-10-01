// Run folders and waivers.
//
// A run folder is what capture-app.mjs writes for one frame x theme x language (x scroll):
//   run.json         { frame, variant, theme, lang, game, scrollY, board, ... }   required
//                    (variant: the reference variant the app's game facts picked, or null;
//                    board: the board rectangle a Game-route frame masks, from the probe launch)
//   app.png          the simulator screenshot (1206 x 2622)        required (run.json "app" may name
//                    another file; only the self-test fixtures do that, and check-signoff refuses it)
//   app.hier.json    `maestro hierarchy` output                    one of these two
//   app.layout.json  an in-app layout reporter's output
//   report.json      written by check-parity.mjs
//   sheet*.png, crops/  written by make-sheet.mjs
// Default location in the app repo: .parity/<game>/<frame>/<theme>-<lang>[-y<scroll>]/
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

import { fail } from '../check-lib.mjs';
import { LANGS, THEMES } from './frames.mjs';
import { DEFAULTS, SKILL_DIR } from './paths.mjs';

export const RUN_FILES = Object.freeze({ info: 'run.json', app: 'app.png', hier: 'app.hier.json', layout: 'app.layout.json', report: 'report.json' });

export function runDirName(theme, lang, scrollY = 0) {
  return `${theme}-${lang}${scrollY ? `-y${scrollY}` : ''}`;
}

export function defaultRunDir(root, { game, frame, theme, lang, scrollY = 0 }) {
  return join(root, game, frame, runDirName(theme, lang, scrollY));
}

/** Every folder under root that holds a run.json (sorted). */
export function findRunDirs(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.isFile() && e.name === RUN_FILES.info)) out.push(dir);
    for (const e of entries) if (e.isDirectory() && e.name !== 'node_modules' && e.name !== 'crops') walk(join(dir, e.name));
  };
  walk(root);
  return out.sort();
}

/** Read run.json and resolve the reference files. */
export function readRun(dir, { referenceRoot } = {}) {
  const infoPath = join(dir, RUN_FILES.info);
  if (!existsSync(infoPath)) fail(`${dir} is not a run folder (no run.json)`, 'Pass a folder written by capture-app.mjs (or shoot-design.mjs --as-app).');
  let info;
  try {
    info = JSON.parse(readFileSync(infoPath, 'utf8'));
  } catch (error) {
    return fail(`${infoPath} is not valid JSON: ${error.message}`, 'Re-capture the run.');
  }
  for (const key of ['frame', 'theme', 'lang']) if (typeof info[key] !== 'string') fail(`${infoPath} has no "${key}"`, 'Re-capture the run with capture-app.mjs.');
  if (!THEMES.includes(info.theme)) fail(`${infoPath}: unknown theme "${info.theme}"`, 'Use light or dark.');
  if (!LANGS.includes(info.lang)) fail(`${infoPath}: unknown language "${info.lang}"`, `Use one of ${LANGS.join(', ')}.`);
  const game = info.game ?? 'lineSiege';
  const variant = typeof info.variant === 'string' && info.variant ? info.variant : null;
  const stem = variant ? `${info.frame}--${variant}` : info.frame;
  const rel = (p) => (isAbsolute(p) ? p : resolve(dir, p));
  let image;
  let layout;
  if (info.reference?.image && info.reference?.layout) {
    image = rel(info.reference.image);
    layout = rel(info.reference.layout);
  } else {
    const root = referenceRoot ? resolve(referenceRoot) : info.referenceRoot ? rel(info.referenceRoot) : DEFAULTS.reference;
    image = join(root, game, `${info.theme}-${info.lang}`, `${stem}.png`);
    layout = join(root, game, `${info.theme}-${info.lang}`, `${stem}.layout.json`);
  }
  const hier = existsSync(join(dir, RUN_FILES.hier)) ? join(dir, RUN_FILES.hier) : null;
  const appLayout = existsSync(join(dir, RUN_FILES.layout)) ? join(dir, RUN_FILES.layout) : null;
  const app = typeof info.app === 'string' ? rel(info.app) : join(dir, RUN_FILES.app);
  return { dir, info: { ...info, game, variant, scrollY: info.scrollY ?? 0 }, reference: { image, layout, name: stem }, app, hier, appLayout };
}

export function mtime(path) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------------------------
// Waivers: parity/waivers.json in the app repo (committed). A waiver accepts one named problem of
// one element on one frame. It never changes a tolerance, and it must say why and when the owner was
// told. Three classes:
//   platform              (default) iOS or React Native cannot draw it like the design;
//   platform-text-shaping text-ink only: CoreText shapes these glyphs or marks differently from
//                         Chrome's HarfBuzz (same font file); names the glyphs;
//   design-artefact       the mockup's own CSS draws something the product does not mean (for example
//                         a flex gap that turns a copy-deck placeholder into a 6 px space); names the
//                         CSS cause in the design copy. The design fix is the owner's; the references
//                         change only when the owner re-renders them.
// ---------------------------------------------------------------------------------------------

export const WAIVABLE_RULES = ['missing', 'bounds', 'text', 'fill', 'border', 'text-ink', 'structure'];
export const WAIVER_CLASSES = ['platform', 'platform-text-shaping', 'design-artefact'];
const WAIVER_KEYS = ['frame', 'testID', 'rule', 'class', 'themes', 'langs', 'games', 'reason', 'glyphs', 'designCause', 'reportedToOwner'];

/** Class-specific checks; returns [message, fix] or null. */
function classProblem(w) {
  const cls = w.class ?? 'platform';
  if (!WAIVER_CLASSES.includes(cls)) return [`class "${cls}" is not a waiver class`, `Use one of ${WAIVER_CLASSES.join(', ')} (omit it for platform).`];
  if (cls !== 'platform-text-shaping' && w.glyphs !== undefined) return ['"glyphs" belongs to a platform-text-shaping waiver', 'Remove it, or use class platform-text-shaping.'];
  if (cls !== 'design-artefact' && w.designCause !== undefined) return ['"designCause" belongs to a design-artefact waiver', 'Remove it, or use class design-artefact.'];
  if (cls === 'platform-text-shaping') {
    if (w.rule !== 'text-ink') return [`a platform-text-shaping waiver covers text-ink only, not "${w.rule}"`, 'Shaping changes glyph ink; any other rule is a fix in the app.'];
    if (typeof w.glyphs !== 'string' || !w.glyphs.trim()) return ['needs "glyphs": the characters or marks CoreText shapes differently (for example "آ")', 'Name the glyphs, measured on the zoomed crop.'];
  }
  if (cls === 'design-artefact') {
    if (w.rule === 'missing') return ['a design-artefact waiver cannot cover "missing"', 'Build the element; ask the owner if the design should not have it.'];
    if (typeof w.designCause !== 'string' || w.designCause.trim().length < 10 || !/[{:]/.test(w.designCause)) {
      return ['needs "designCause": the mockup CSS that draws the artefact (for example ".set-foot span{display:flex;gap:6px}")', 'Quote the rule from assets/design/toybox.html and say what it does to this element.'];
    }
  }
  return null;
}

export function readWaivers(path) {
  if (!path || !existsSync(path)) return { path, waivers: [], problems: [] };
  let json;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { path, waivers: [], problems: [{ rule: 'waiver-invalid', message: `not valid JSON: ${error.message}`, fix: 'Fix the JSON syntax.' }] };
  }
  const problems = [];
  const waivers = [];
  if (json.version !== 1 || !Array.isArray(json.waivers)) problems.push({ rule: 'waiver-invalid', message: 'expected { "version": 1, "waivers": [...] }', fix: 'Start from the skill\'s templates/parity/waivers.json.' });
  (json.waivers ?? []).forEach((w, i) => {
    const at = `waiver ${i + 1}${w?.frame ? ` (${w.frame} ${w.testID ?? '?'} ${w.rule ?? '?'})` : ''}`;
    const bad = (message, fix) => problems.push({ rule: 'waiver-invalid', message: `${at}: ${message}`, fix });
    if (!w || typeof w !== 'object') return bad('is not an object', 'Remove it.');
    const extra = Object.keys(w).filter((k) => !WAIVER_KEYS.includes(k));
    if (extra.length) return bad(`unknown field(s) ${extra.join(', ')}`, `A waiver has only ${WAIVER_KEYS.join(', ')}; it can never change a tolerance.`);
    if (typeof w.frame !== 'string' || typeof w.testID !== 'string' || !w.testID || w.testID.includes('*')) return bad('needs a frame and one exact testID', 'Name the frame key and the testID (no wildcards).');
    if (!WAIVABLE_RULES.includes(w.rule)) return bad(`rule "${w.rule}" cannot be waived`, `Waivable rules: ${WAIVABLE_RULES.join(', ')}. A wrong capture or an unreached screen is never waived.`);
    const classIssue = classProblem(w);
    if (classIssue) return bad(...classIssue);
    if (typeof w.reason !== 'string' || w.reason.trim().length < 20) return bad('needs a reason of at least 20 characters naming the platform limit or the design artefact', 'Say exactly what iOS or React Native cannot draw (or what the mockup CSS does) and why.');
    if (typeof w.reportedToOwner !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(w.reportedToOwner)) return bad('needs "reportedToOwner": "YYYY-MM-DD"', 'Tell the owner in the task report, then record the date.');
    for (const key of ['themes', 'langs', 'games']) if (w[key] !== undefined && (!Array.isArray(w[key]) || w[key].length === 0)) return bad(`"${key}" must be a non-empty list when present`, 'Omit it to mean every value.');
    waivers.push({ ...w, class: w.class ?? 'platform', index: i + 1 });
  });
  return { path, waivers, problems };
}

/** Split problems into { kept, waived } for one run. */
export function applyWaivers(problems, waivers, info) {
  const kept = [];
  const waived = [];
  const used = new Set();
  for (const p of problems) {
    const w = waivers.find(
      (x) => x.frame === info.frame && x.rule === p.rule && x.testID === p.testID
        && (!x.themes || x.themes.includes(info.theme)) && (!x.langs || x.langs.includes(info.lang)) && (!x.games || x.games.includes(info.game)),
    );
    if (w) {
      waived.push({ ...p, waiver: { index: w.index, class: w.class, reason: w.reason, reportedToOwner: w.reportedToOwner } });
      used.add(w.index);
    } else kept.push(p);
  }
  const unused = waivers.filter((w) => w.frame === info.frame && !used.has(w.index)
    && (!w.themes || w.themes.includes(info.theme)) && (!w.langs || w.langs.includes(info.lang)) && (!w.games || w.games.includes(info.game)));
  return { kept, waived, unused };
}

// ---------------------------------------------------------------------------------------------
// Pre-listed waivers: problems every correct build shows, whose cause is known and was reported to
// the owner, shipped as entries of templates/parity/waivers.json (the one list; check-parity names
// the entry in its fix text, and an app repo copies the template). Two kinds today:
//   platform         React Native on iOS draws borderStyle 'dashed' with its own dash length and
//                    phase, and no style sets them: the dashed edges of the locked level tiles, the
//                    locked pack panel, the S7 offer box, the S9 missed and today marks and legend
//                    swatch, and the disabled S12 Buy key differ from Chrome's along the edge only;
//                    iOS draws the edges of a rotated view without antialiasing (the S9 calendar
//                    month in dark fa); and iOS snaps each line box of a multi-line text to the
//                    device pixel grid, so the S14 restart card in fa (three two-line Vazirmatn
//                    texts) comes out 353.33 pt tall against Chrome's 352 (structure).
//   design-artefact  the S8 mockup draws tile 13 mid-press (.lt.is-pressed), a squash no app can
//                    hold after the finger lifts (bounds and structure); the S11b version chip's
//                    .chip{gap:6px} splits "Version" and the version into two flex items (en).
// ---------------------------------------------------------------------------------------------
export const PRELISTED_WAIVERS_FILE = join(SKILL_DIR, 'templates', 'parity', 'waivers.json');

let prelisted = null;
/** The template's waivers (read once). */
export function prelistedWaivers() {
  prelisted ??= existsSync(PRELISTED_WAIVERS_FILE) ? readWaivers(PRELISTED_WAIVERS_FILE).waivers : [];
  return prelisted;
}

/** The pre-listed waiver for one problem of one run, as { class, cause }, or null. */
export function prelistedWaiverFor(problem, info) {
  const w = prelistedWaivers().find((x) => x.frame === info.frame && x.testID === problem.testID && x.rule === problem.rule
    && (!x.themes || x.themes.includes(info.theme)) && (!x.langs || x.langs.includes(info.lang)) && (!x.games || x.games.includes(info.game)));
  if (!w) return null;
  const sentences = w.reason.split(/(?<=\.) /);
  const platformCause = /dash/i.test(w.reason) ? "React Native's iOS dash pattern" : (sentences.find((x) => /iOS|React Native/.test(x)) ?? sentences[0]).replace(/\.$/, '');
  return { class: w.class, cause: w.class === 'design-artefact' ? `mockup CSS ${w.designCause}` : platformCause };
}
