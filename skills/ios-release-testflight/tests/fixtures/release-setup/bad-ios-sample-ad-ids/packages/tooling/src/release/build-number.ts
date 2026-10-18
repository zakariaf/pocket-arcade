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

export function buildTag(slug: string, version: string, buildNumber: number): string {
  return `${slug}/v${version}+${String(buildNumber)}`;
}

export function releaseTag(slug: string, version: string): string {
  return `${slug}/v${version}`;
}
