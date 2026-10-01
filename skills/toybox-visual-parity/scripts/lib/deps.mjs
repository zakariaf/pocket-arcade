// Loads the pinned packages (scripts/package.json) at run time, so --help and argument errors work
// before `npm ci`. The packages live in a tooling folder: --tooling <dir>, else $PARITY_TOOLING_DIR,
// else this skill's own scripts/ folder. A session whose skill folder must stay read-only (or is
// shared by other sessions) installs them into the app repo instead:
//   npm ci --prefix <repo>/.parity/tooling   (from a copy of scripts/package.json and package-lock.json)
// and passes --tooling <repo>/.parity/tooling. A missing package stops the script with exit 2 and
// both install forms.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fail, importPackage, packageInstallFix, resolveToolingDir } from '../check-lib.mjs';
import { SCRIPTS_DIR } from './paths.mjs';

export const TOOLING_ENV = 'PARITY_TOOLING_DIR';
export const TOOLING_REPO_DIR = '.parity/tooling';

/** The --tooling option every script that loads a package declares. */
export const TOOLING_OPTION = Object.freeze({
  type: 'string',
  value: 'dir',
  help: `Folder whose node_modules holds the pinned packages (default: $${TOOLING_ENV}, else the skill's scripts folder)`,
});

/** The tooling folder of this run (absolute). */
export function toolingDirOf(options = {}) {
  return resolveToolingDir({ given: options.tooling, envVar: TOOLING_ENV, scriptsDir: SCRIPTS_DIR });
}

/** The arguments that pass this run's tooling folder on to another script of the skill. */
export function toolingArgs(options = {}) {
  return options.tooling ? ['--tooling', toolingDirOf(options)] : [];
}

/** The fix text for a missing package: the skill-folder install and the --tooling install. */
export function installFix() {
  return packageInstallFix({ scriptsDir: SCRIPTS_DIR, envVar: TOOLING_ENV, repoDir: TOOLING_REPO_DIR });
}

export async function loadImageDeps(tooling = toolingDirOf()) {
  const fix = installFix();
  const { PNG } = await importPackage('pngjs', tooling, { what: 'pngjs 7.0.0', fix });
  const pixelmatchModule = await importPackage('pixelmatch', tooling, { what: 'pixelmatch 7.2.0', fix });
  return { PNG, pixelmatch: pixelmatchModule.default ?? pixelmatchModule };
}

export async function loadPlaywright(tooling = toolingDirOf()) {
  const mod = await importPackage('playwright', tooling, { what: 'playwright 1.63.0', fix: `${installFix()} No browser download: the scripts use the installed Google Chrome.` });
  const pw = mod.chromium ? mod : mod.default;
  if (!pw?.chromium) fail(`playwright in ${tooling} has no chromium export`, installFix());
  return pw;
}

/** The installed playwright version (for the reference manifest), or 'unknown'. */
export function playwrightVersion(tooling = toolingDirOf()) {
  try {
    return JSON.parse(readFileSync(join(tooling, 'node_modules', 'playwright', 'package.json'), 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

// --disable-gpu: software rasterisation. With GPU rasterisation two renders of the same frame
// differed in 2 to 2,451 edge pixels (up to 57/255) from one Chrome process to the next; in
// software mode four renders in a row were identical, and the probe app's verdicts did not change.
export const CHROME_ARGS = Object.freeze(['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text', '--hide-scrollbars', '--disable-gpu']);

/** Launch the installed Google Chrome with the flags that make renders deterministic. */
export async function launchChrome(pw) {
  const args = [...CHROME_ARGS];
  try {
    return await pw.chromium.launch({ channel: 'chrome', headless: true, args });
  } catch (error) {
    return fail(
      `Google Chrome could not be launched through Playwright (${String(error.message).split('\n')[0]})`,
      'Install Google Chrome (the references were rendered with the "chrome" channel); never swap in another browser, it rasterises text differently.',
    );
  }
}
