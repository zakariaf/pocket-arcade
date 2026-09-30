// packages/tooling/src/e2e/run-e2e-ios.ts (excerpt)
export function maestroArgs(tags: readonly string[]): readonly string[] {
  return ['test', '--include-tags', tags.join(','), '--format', 'junit'];
}
