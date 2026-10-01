// packages/tooling/src/quality/shell-slice.ts
// A repo without every Shell screen declares so in shell-slice.json at its root, for example
// { "screens": ["S4", "S11", "S12"], "why": "Home + Settings parity slice" }; "screens": [] is a
// game-first repo with no Shell app, and no file means the full Shell (every gate is strict).
// The skill checkers read the same file with the same rules (check-lib's readShellSlice).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const SHELL_SLICE_FILE = 'shell-slice.json';

/** Every Shell screen id a slice may name: S1-S15 and the four Settings sub-screens. */
export const SHELL_SCREEN_IDS: readonly string[] = [
  ...Array.from({ length: 15 }, (_, index) => `S${String(index + 1)}`),
  'S11a',
  'S11b',
  'S11c',
  'S11d',
];

export type ShellSlice = {
  readonly screens: ReadonlySet<string>;
  readonly why: string;
  /** False for "screens": [], a game-first repo with no Shell app. */
  readonly hasShellApp: boolean;
};

const ALLOWED_KEYS = new Set(['screens', 'why', '$comment']);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function screensOf(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${SHELL_SLICE_FILE} needs "screens": a list of screen ids`);
  }
  const screens = value.map((item: unknown) => String(item));
  const unknown = screens.filter((id) => !SHELL_SCREEN_IDS.includes(id));
  if (unknown.length > 0) {
    throw new Error(`${SHELL_SLICE_FILE} names unknown screens: ${unknown.join(', ')}`);
  }
  if (new Set(screens).size !== screens.length) {
    throw new Error(`${SHELL_SLICE_FILE} lists a screen twice`);
  }
  return screens;
}

/** Parses the file's text; a malformed slice throws, so no gate relaxes on a typo. */
export function parseShellSlice(text: string): ShellSlice {
  const data: unknown = JSON.parse(text);
  if (!isRecord(data)) {
    throw new Error(`${SHELL_SLICE_FILE} must hold one object`);
  }
  const extra = Object.keys(data).filter((key) => !ALLOWED_KEYS.has(key));
  if (extra.length > 0) {
    throw new Error(`${SHELL_SLICE_FILE} has unknown keys: ${extra.join(', ')}`);
  }
  const screens = screensOf(data['screens']);
  const why = data['why'];
  if (typeof why !== 'string' || why.trim() === '') {
    throw new Error(
      `${SHELL_SLICE_FILE} needs "why": one sentence on why only these screens exist`,
    );
  }
  return { screens: new Set(screens), why: why.trim(), hasShellApp: screens.length > 0 };
}

/** The repo's slice, or null when shell-slice.json does not exist (the full Shell). */
export function readShellSlice(repoRoot: string): ShellSlice | null {
  const file = path.join(repoRoot, SHELL_SLICE_FILE);
  return existsSync(file) ? parseShellSlice(readFileSync(file, 'utf8')) : null;
}
