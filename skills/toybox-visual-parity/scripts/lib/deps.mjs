// Loads the pinned packages (scripts/package.json) at run time, so --help and argument errors work
// before `npm ci`. A missing package stops the script with exit 2 and the install command.
import { fail } from '../check-lib.mjs';
import { INSTALL_HINT } from './paths.mjs';

export async function loadImageDeps() {
  try {
    const { PNG } = await import('pngjs');
    const { default: pixelmatch } = await import('pixelmatch');
    return { PNG, pixelmatch };
  } catch {
    return fail('the image packages (pngjs 7.0.0, pixelmatch 7.2.0) are not installed', `Run: ${INSTALL_HINT}`);
  }
}

export async function loadPlaywright() {
  try {
    const mod = await import('playwright');
    const pw = mod.chromium ? mod : mod.default;
    if (!pw?.chromium) throw new Error('no chromium export');
    return pw;
  } catch {
    return fail('playwright 1.63.0 is not installed', `Run: ${INSTALL_HINT} (no browser download: the scripts use the installed Google Chrome)`);
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
