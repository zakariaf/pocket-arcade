// packages/tooling/src/quality/shell-slice.test.ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { parseShellSlice, readShellSlice, SHELL_SCREEN_IDS } from './shell-slice.ts';

describe('parseShellSlice', () => {
  it('reads the screens and the reason', () => {
    const slice = parseShellSlice('{ "screens": ["S4", "S11", "S11a"], "why": " parity slice " }');
    expect([...slice.screens]).toStrictEqual(['S4', 'S11', 'S11a']);
    expect(slice.why).toBe('parity slice');
    expect(slice.hasShellApp).toBe(true);
  });

  it('marks a game-first repo as having no Shell app', () => {
    expect(parseShellSlice('{ "screens": [], "why": "game first" }').hasShellApp).toBe(false);
  });

  it.each([
    ['[]', /one object/u],
    ['{ "screens": ["S4"], "why": "x", "routes": [] }', /unknown keys: routes/u],
    ['{ "why": "x" }', /needs "screens"/u],
    ['{ "screens": ["S4", "S16"], "why": "x" }', /unknown screens: S16/u],
    ['{ "screens": ["S4", "S4"], "why": "x" }', /twice/u],
    ['{ "screens": ["S4"], "why": " " }', /needs "why"/u],
  ])('rejects the malformed slice %s', (text, message) => {
    expect(() => parseShellSlice(text)).toThrow(message);
  });

  it('knows the nineteen screen ids', () => {
    expect(SHELL_SCREEN_IDS).toHaveLength(19);
    expect(SHELL_SCREEN_IDS).toContain('S15');
    expect(SHELL_SCREEN_IDS).toContain('S11d');
  });
});

describe('readShellSlice', () => {
  // Each test gets its own folder: `npm run test:coverage` runs tests in random order, and a slice
  // file written by one test must never leak into another.
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'shell-slice-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns null without the file', () => {
    expect(readShellSlice(root)).toBeNull();
  });

  it('reads the file at the repo root', () => {
    writeFileSync(path.join(root, 'shell-slice.json'), '{ "screens": ["S4"], "why": "Home" }');
    expect(readShellSlice(root)?.screens.has('S4')).toBe(true);
  });

  it('throws on a malformed file instead of relaxing any gate', () => {
    writeFileSync(path.join(root, 'shell-slice.json'), '{ "screens": ["S99"], "why": "typo" }');
    expect(() => readShellSlice(root)).toThrow(/unknown screens: S99/u);
  });
});
