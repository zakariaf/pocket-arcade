// packages/shell/src/services/save/fixtures/fixture-checksums.ts
// Frozen fixtures: a shipped save format is a compatibility contract (N10).
// Changing a value here needs a `Gate-Change:` commit trailer (lefthook commit-msg).
export const FIXTURE_CHECKSUMS = {
  'save-v1.minimal': '1b56e4df',
  'save-v1.full': '11926b41',
} as const;
