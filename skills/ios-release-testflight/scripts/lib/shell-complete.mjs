// shell-complete.mjs: a partial Shell never ships. Shared by check-release-setup.mjs (the repo) and
// check-store-artifact.mjs (the repo the .ipa was built from, and the built bundle). Not an entry point.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { lineOf, maskComments, readShellSlice, SHELL_SCREEN_IDS, walk } from '../check-lib.mjs';

/** The placeholder's testID (navigation-and-routing's not-built-screen.tsx): in a bundle it means a route uses it. */
export const NOT_BUILT_TESTID = 'not-built.screen';
const NAVIGATION = 'packages/shell/src/navigation';
const SLICE_FIX = 'A slice never ships: build the missing screens (toybox-screens), point every route at its real screen, delete shell-slice.json and rerun check-navigation.mjs . --complete (navigation-and-routing).';

/**
 * Problems ({ file, line, message, fix }) that make the repo a partial Shell: shell-slice.json
 * exists, or a route in packages/shell/src/navigation/ points at NotBuiltScreen.
 */
export function partialShellProblems(root) {
  const problems = [];
  const slice = readShellSlice(root);
  if (slice !== null) {
    const missing = SHELL_SCREEN_IDS.filter((id) => !slice.screens.has(id));
    const built = missing.length === 0 ? 'every screen is listed, but the file must go' : `not built: ${missing.join(', ')}`;
    problems.push({ file: slice.file, line: 0, message: `exists, so this is a partial Shell (${slice.why}); ${built}`, fix: SLICE_FIX });
  }
  const navigation = join(root, NAVIGATION);
  if (!existsSync(navigation)) return problems;
  for (const rel of walk(navigation, { include: ['*.ts', '*.tsx'], ignore: ['*.test.ts', '*.test.tsx', 'not-built-screen.tsx'] })) {
    const source = maskComments(readFileSync(join(navigation, rel), 'utf8'));
    for (const match of source.matchAll(/(\w+)\s*:\s*NotBuiltScreen\b/g)) {
      const route = match[1] === 'screen' ? 'a route' : `route ${match[1]}`;
      problems.push({ file: `${NAVIGATION}/${rel}`, line: lineOf(source, match.index), message: `${route} still points at NotBuiltScreen`, fix: 'Register the real screen component for it (toybox-screens builds the screen); a placeholder never ships.' });
    }
  }
  return problems;
}
