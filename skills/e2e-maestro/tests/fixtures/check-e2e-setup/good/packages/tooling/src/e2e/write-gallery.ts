// packages/tooling/src/e2e/write-gallery.ts — one static HTML page the owner opens locally.
import { writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { PngComparison } from '@e07/tooling/visual/compare-png.ts';

export const NEW_BASELINE = 'baseline-written';
export const CAPTURE_FAILED = 'capture-failed';
/** A combination that captured nothing usable (screenshot-matrix.ts): its error and log folder. */
export type CaptureFailure = {
  readonly kind: typeof CAPTURE_FAILED;
  readonly message: string;
  readonly outDir: string;
};
export type RowResult = PngComparison | CaptureFailure | typeof NEW_BASELINE;
export type GalleryRow = {
  readonly label: string;
  readonly actual: string;
  readonly baseline: string;
  readonly result: RowResult;
};

const OUT_DIR = join('reports', 'screenshots');

export function isChanged(result: RowResult): boolean {
  return result !== NEW_BASELINE && result.kind !== 'match';
}

function cell(path: string | null): string {
  return path === null
    ? '<td></td>'
    : `<td><img loading="lazy" src="${relative(OUT_DIR, path)}"></td>`;
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function row({ label, actual, baseline, result }: GalleryRow): string {
  if (result !== NEW_BASELINE && result.kind === CAPTURE_FAILED) {
    return `<tr class="${CAPTURE_FAILED}"><th>${label}<br>${CAPTURE_FAILED}</th><td colspan="3">${escapeHtml(result.message)}<br>Maestro log: ${escapeHtml(relative(OUT_DIR, result.outDir))}</td></tr>`;
  }
  const status = result === NEW_BASELINE ? 'new baseline' : result.kind;
  const diff = result !== NEW_BASELINE && result.kind === 'mismatch' ? result.diffPath : null;
  return `<tr class="${status}"><th>${label}<br>${status}</th>${cell(baseline)}${cell(actual)}${cell(diff)}</tr>`;
}

export function writeGallery(rows: readonly GalleryRow[]): string {
  const sorted = [...rows].sort(
    (a, b) => Number(isChanged(b.result)) - Number(isChanged(a.result)),
  );
  const html = `<!doctype html><meta charset="utf-8"><title>Screenshot matrix</title>
<style>body{font:14px system-ui;margin:16px}img{width:220px}th{text-align:start;vertical-align:top}
tr.mismatch th,tr.size-changed th,tr.capture-failed th{color:#b00020}</style>
<h1>Screenshot matrix</h1><p>Columns: baseline | this run | diff (red = changed pixels). Changed rows first.</p>
<table>${sorted.map(row).join('\n')}</table>`;
  const file = join(OUT_DIR, 'index.html');
  writeFileSync(file, html);
  return file;
}
