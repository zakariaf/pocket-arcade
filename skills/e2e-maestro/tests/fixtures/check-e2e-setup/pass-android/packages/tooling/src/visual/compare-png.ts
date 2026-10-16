// packages/tooling/src/visual/compare-png.ts — one comparator for headless board renders and
// simulator screenshots. Writes a diff PNG the agent can open with its Read tool. The sizes come
// from the two PNG headers before anything is decoded, and the diff image is drawn only for a
// mismatch (most comparisons match, and a 1320x2868 diff buffer is 15 MB).
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

const PIXELMATCH = { threshold: 0.1 } as const;

/** "<width>x<height>" from a PNG's IHDR chunk (bytes 16-23, right after the signature). */
function sizeOf(png: Buffer): string {
  return `${String(png.readUInt32BE(16))}x${String(png.readUInt32BE(20))}`;
}

export function comparePng(actual: Buffer, options: CompareOptions): PngComparison {
  if (!existsSync(options.baselinePath)) {
    return { kind: 'missing-baseline', baselinePath: options.baselinePath };
  }
  const expected = readFileSync(options.baselinePath);
  if (sizeOf(expected) !== sizeOf(actual)) {
    return { kind: 'size-changed', expected: sizeOf(expected), actual: sizeOf(actual) };
  }
  const expectedPng = pngjs.PNG.sync.read(expected);
  const actualPng = pngjs.PNG.sync.read(actual);
  const { width, height } = expectedPng;
  const pixels = pixelmatch(expectedPng.data, actualPng.data, undefined, width, height, PIXELMATCH);
  const diffRatio = pixels / (width * height);
  if (diffRatio <= options.maxDiffRatio) {
    return { kind: 'match', diffRatio };
  }
  const diff = new pngjs.PNG({ width, height });
  pixelmatch(expectedPng.data, actualPng.data, diff.data, width, height, PIXELMATCH);
  mkdirSync(dirname(options.diffPath), { recursive: true });
  writeFileSync(options.diffPath, pngjs.PNG.sync.write(diff));
  return { kind: 'mismatch', diffRatio, diffPath: options.diffPath };
}
