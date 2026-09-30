// budgets.mjs: the Pocket Arcade performance budgets (the defaults of quality-gates.json "perf")
// and a loader that reads the project's values. Not an entry point.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** key -> [default, direction]: 'max' = the value may not rise above the default, 'min' = not below. */
export const PERF_BUDGETS = {
  coldStartHomeMsMax: [1000, 'max', 'cold start, process start to Home interactive, median of 5 launches on the owner\'s iPhone (ms)'],
  coldStartSimRegressionFactor: [1.2, 'max', 'simulator cold start may be at most this times the committed baseline'],
  hitchMsPerSecondMax: [10, 'max', 'hitch rate while boards animate (ms of hitch per second; Apple: good <= 10)'],
  frameP95MsMax: [17, 'max', 'p95 frame time while animating (ms, bucket upper bound)'],
  saveWriteP95MsMax: [5, 'max', 'p95 of the per-move save write (ms)'],
  drawCallsPerFrameMax: [1000, 'max', 'ceiling for every game\'s per-frame draw-call budget'],
  bundleJsBytesMax: [6000000, 'max', 'minified JS of the store build, expo export --no-bytecode (bytes)'],
  bundleGrowthMaxRatio: [1.1, 'max', 'bundle may grow at most this times the committed baseline'],
  memoryFootprintMbMax: [150, 'max', 'phys_footprint after the smoke flow on the simulator (MB)'],
  levelGridTilesMax: [150, 'max', 'level tiles mounted on one screen'],
  skiaCanvasesPerScreenMax: [8, 'max', 'Skia canvases per screen outside the board'],
};

export function defaultBudgets() {
  return Object.fromEntries(Object.entries(PERF_BUDGETS).map(([key, [value]]) => [key, value]));
}

/** The project's perf budgets (quality-gates.json under root), falling back to the defaults. */
export function loadBudgets(root) {
  const file = join(root, 'quality-gates.json');
  const budgets = defaultBudgets();
  if (!existsSync(file)) return { budgets, file: null };
  const perf = JSON.parse(readFileSync(file, 'utf8')).perf ?? {};
  for (const key of Object.keys(budgets)) if (typeof perf[key] === 'number') budgets[key] = perf[key];
  return { budgets, file };
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return Number.NaN;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
