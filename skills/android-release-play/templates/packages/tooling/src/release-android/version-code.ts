// packages/tooling/src/release-android/version-code.ts
// iOS and Android share one build number per game: game.config.ts `buildNumber` is iOS's
// CFBundleVersion and Android's versionCode, and every upload is tagged <game>/vX.Y.Z+<n>. A
// number is never reused or rolled back (Google Play refuses a used versionCode for good), so the
// next one is above both the config and every upload tag of the game.

export type VersionCodeInput = {
  readonly game: string;
  /** buildNumber in apps/<game>/game.config.ts now. */
  readonly configBuildNumber: number;
  /** `git tag --list '<game>/v*'` (other games' tags are ignored). */
  readonly tags: readonly string[];
};

function uploadTagPattern(game: string): RegExp {
  const escaped = game.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}/v\\d+\\.\\d+\\.\\d+\\+(\\d+)$`);
}

/** The build numbers of the game's upload tags (`<game>/vX.Y.Z+<n>`), in tag order. */
export function buildNumbersOfTags(tags: readonly string[], game: string): number[] {
  const pattern = uploadTagPattern(game);
  return tags
    .map((tag) => pattern.exec(tag)?.[1])
    .filter((digits): digits is string => digits !== undefined)
    .map(Number);
}

/** One above the highest number the config or any upload tag of the game has used. */
export function nextVersionCode(input: VersionCodeInput): number {
  return Math.max(input.configBuildNumber, ...buildNumbersOfTags(input.tags, input.game)) + 1;
}

/** Throws when an upload tag of the game already carries this number or a higher one. */
export function assertUnusedVersionCode(
  versionCode: number,
  game: string,
  tags: readonly string[],
): void {
  const pattern = uploadTagPattern(game);
  const blocking = tags.find((tag) => Number(pattern.exec(tag)?.[1] ?? -1) >= versionCode);
  if (blocking !== undefined) {
    throw new Error(
      `versionCode ${String(versionCode)} is not above ${blocking}: a number is never reused or rolled back`,
    );
  }
}
