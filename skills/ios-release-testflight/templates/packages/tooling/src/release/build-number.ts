// packages/tooling/src/release/build-number.ts
// Pure: bumps the single `buildNumber: <int>,` line in apps/<game>/game.config.ts.
const BUILD_NUMBER_LINE = /^(\s*buildNumber: )(\d+)(,)$/gm;

export type BuildNumberBump = {
  readonly text: string;
  readonly previous: number;
  readonly next: number;
};

export function bumpBuildNumber(gameConfigSource: string): BuildNumberBump {
  const found = [...gameConfigSource.matchAll(BUILD_NUMBER_LINE)];
  const digits = found[0]?.[2];
  if (found.length !== 1 || digits === undefined) {
    throw new Error(
      `expected exactly one "buildNumber: <int>," line, found ${String(found.length)}`,
    );
  }
  const previous = Number(digits);
  const next = previous + 1;
  const text = gameConfigSource.replace(BUILD_NUMBER_LINE, `$1${String(next)}$3`);
  return { text, previous, next };
}

export type ResumeCheck = {
  readonly game: string;
  /** game.config.ts as it is now (after the earlier run's bump commit). */
  readonly gameConfigSource: string;
  /** `git log -1 --format=%s` */
  readonly headSubject: string;
  /** `git tag --list '<game>/v*'` */
  readonly tags: readonly string[];
};

/**
 * The build number a resumed release reuses. Allowed only while HEAD is still this game's bump
 * commit for that number and no build tag carries it; otherwise a fresh run takes a new number
 * (gaps are harmless, Apple only rejects duplicates).
 */
export function resumableBuildNumber(check: ResumeCheck): number {
  const current = bumpBuildNumber(check.gameConfigSource).previous;
  const expected = `chore(${check.game}): build ${String(current)}`;
  if (check.headSubject.trim() !== expected) {
    throw new Error(
      `cannot resume: HEAD is "${check.headSubject.trim()}", not "${expected}". Run release:ios without --resume.`,
    );
  }
  const isTagged = check.tags.some(
    (tag) => tag.startsWith(`${check.game}/v`) && tag.endsWith(`+${String(current)}`),
  );
  if (isTagged) {
    throw new Error(`cannot resume: build ${String(current)} is already tagged (released)`);
  }
  return current;
}

export function buildTag(slug: string, version: string, buildNumber: number): string {
  return `${slug}/v${version}+${String(buildNumber)}`;
}

export function releaseTag(slug: string, version: string): string {
  return `${slug}/v${version}`;
}
