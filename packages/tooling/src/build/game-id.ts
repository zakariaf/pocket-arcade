// packages/tooling/src/build/game-id.ts
// The one game-id check of the tooling CLIs (build:ios:sim, release:ios, the build-number bump and
// the StoreKit harness): a game id is its kebab-case folder under apps/. And the one app-id check
// (print-app-record, the Premium product script): io.applander.<game id without hyphens>.

/** line-siege, flock-tilt: lowercase letters and digits in words joined by single hyphens. */
export function isGameId(value: string | undefined): value is string {
  return value !== undefined && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
}

/** io.applander.linesiege: every game's bundle id (owner decision O4). */
export function isAppId(value: string | undefined): value is string {
  return value !== undefined && /^io\.applander\.[a-z0-9]+$/.test(value);
}
