// packages/tooling/src/e2e/run-e2e-ios.ts (excerpt)
export function maestroArgs(tags: readonly string[]): readonly string[] {
  return ['test', '--tags', tags.join(',')];
}
