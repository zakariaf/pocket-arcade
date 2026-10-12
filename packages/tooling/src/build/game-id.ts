// packages/tooling/src/build/game-id.ts
// The one game-id check of the tooling CLIs (build:ios:sim, release:ios, the build-number bump and
// the StoreKit harness): a game id is its kebab-case folder under apps/.

/** line-siege, flock-tilt: lowercase letters and digits in words joined by single hyphens. */
export function isGameId(value: string | undefined): value is string {
  return value !== undefined && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
}
