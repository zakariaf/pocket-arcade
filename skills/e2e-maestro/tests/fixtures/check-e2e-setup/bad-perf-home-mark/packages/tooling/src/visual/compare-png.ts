// packages/tooling/src/visual/compare-png.ts — one comparator for headless board renders and
// simulator screenshots. Writes a diff PNG the agent can open with its Read tool.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import pixelmatch from 'pixelmatch';
import pngjs from 'pngjs';

export type PngComparison =
  | { readonly kind: 'match'; readonly diffRatio: number }
  | { readonly kind: 'mismatch'; readonly diffRatio: number; readonly diffPath: string }
  | { readonly kind: 'size-changed'; readonly expected: string; readonly actual: string }
  | { readonly kind: 'missing-baseline'; readonly baselinePath: string };

export type CompareOptions = {
  readonly baselinePath: string;
  readonly diffPath: string;
  readonly maxDiffRatio: number;
};

export function comparePng(actual: Buffer, options: CompareOptions): PngComparison {
  if (!existsSync(options.baselinePath)) {
    return { kind: 'missing-baseline', baselinePath: options.baselinePath };
  }
  const expectedPng = pngjs.PNG.sync.read(readFileSync(options.baselinePath));
  const actualPng = pngjs.PNG.sync.read(actual);
  const { width, height } = expectedPng;
  if (actualPng.width !== width || actualPng.height !== height) {
    return {
      kind: 'size-changed',
      expected: `${String(width)}x${String(height)}`,
      actual: `${String(actualPng.width)}x${String(actualPng.height)}`,
    };
  }
  const diff = new pngjs.PNG({ width, height });
  const pixels = pixelmatch(expectedPng.data, actualPng.data, diff.data, width, height, {
    threshold: 0.1,
  });
  const diffRatio = pixels / (width * height);
  if (diffRatio <= options.maxDiffRatio) {
    return { kind: 'match', diffRatio };
  }
  mkdirSync(dirname(options.diffPath), { recursive: true });
  writeFileSync(options.diffPath, pngjs.PNG.sync.write(diff));
  return { kind: 'mismatch', diffRatio, diffPath: options.diffPath };
}
