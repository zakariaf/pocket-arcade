// packages/tooling/src/e2e/screenshot-compare.ts
// The compare core screenshots:ios and screenshots:android share: one tolerance for both
// (MAX_DIFF_RATIO, 0.2 % of the pixels, never raised), the combinations of a device (every language
// in light, then in dark), each combination's folders, its matrix job, and the check of one
// capture against its baseline (or, with --update, the capture written as the new baseline). Each
// platform keeps its own folders (ShotLayout): iOS apps/<game>/e2e/baselines/ and
// reports/screenshots/, Android baselines-android/ and reports/screenshots-android/.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { NEW_BASELINE, type GalleryRow } from '@e07/tooling/e2e/write-gallery.ts';

import type { MatrixJob } from '@e07/tooling/e2e/screenshot-matrix.ts';
import type { comparePng } from '@e07/tooling/visual/compare-png.ts';

/** The share of pixels a capture may differ by from its baseline, on both platforms. */
export const MAX_DIFF_RATIO = 0.002;

export type Combo = {
  readonly device: string;
  readonly lang: string;
  readonly theme: 'light' | 'dark';
};

/** Where one platform's matrix keeps its files. */
export type ShotLayout = {
  readonly game: string;
  /** The folder under apps/<game>/e2e/: baselines (iOS) or baselines-android. */
  readonly baselines: string;
  /** reports/screenshots or reports/screenshots-android (raw/ and diff/ below it). */
  readonly reports: string;
  /** Appended to each combination's folder: the text size or font scale, '' at the default. */
  readonly suffix: string;
  /** --update: write the captures as the new baselines instead of comparing. */
  readonly isUpdate: boolean;
  /** compare-png's comparePng (passed in: pixelmatch is an ES module Jest cannot load). */
  readonly compare: typeof comparePng;
};

/** `<device>/<lang>-<theme><suffix>`: the label and the folder of a combination. */
const comboDirOf = (layout: ShotLayout, combo: Combo): string =>
  join(combo.device, `${combo.lang}-${combo.theme}${layout.suffix}`);

const baselineDirOf = (layout: ShotLayout, combo: Combo): string =>
  join('apps', layout.game, 'e2e', layout.baselines, comboDirOf(layout, combo));

/** Where Maestro writes a combination's log and screenshots: <reports>/raw/<combination>. */
export const rawDirOf = (layout: ShotLayout, combo: Combo): string =>
  join(layout.reports, 'raw', comboDirOf(layout, combo));

/** Every language in light, then every language in dark, on one device. */
export function combosOf<TDevice extends string>(
  langs: readonly string[],
  device: TDevice,
): (Combo & { readonly device: TDevice })[] {
  return (['light', 'dark'] as const).flatMap((theme) =>
    langs.map((lang) => ({ device, lang, theme })),
  );
}

/** The combination's job: its label and folders, and its capture once `run` gets the device. */
export function jobOf(
  layout: ShotLayout,
  combo: Combo,
  run: () => Promise<GalleryRow[]>,
): MatrixJob {
  return {
    label: comboDirOf(layout, combo),
    outDir: rawDirOf(layout, combo),
    baselineDir: baselineDirOf(layout, combo),
    run,
  };
}

/** One capture against the baseline of its name (its diff under diff/), or written as the baseline. */
export function checkShot(layout: ShotLayout, combo: Combo, actual: string): GalleryRow {
  const baselineDir = baselineDirOf(layout, combo);
  const baseline = join(baselineDir, basename(actual));
  const label = `${comboDirOf(layout, combo)}/${basename(actual, '.png')}`;
  if (layout.isUpdate) {
    mkdirSync(baselineDir, { recursive: true });
    copyFileSync(actual, baseline);
    return { label, actual, baseline, result: NEW_BASELINE };
  }
  const diffPath = join(layout.reports, 'diff', comboDirOf(layout, combo), basename(actual));
  const result = layout.compare(readFileSync(actual), {
    baselinePath: baseline,
    diffPath,
    maxDiffRatio: MAX_DIFF_RATIO,
  });
  return { label, actual, baseline, result };
}
