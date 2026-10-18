// packages/tooling/src/build/flag-pairs.ts
// The command lines of build:ios:sim, build:android:emu and release:android: `--flag value` pairs
// only, each flag one the CLI knows; anything else stops the run with the CLI's usage.

/** `--flag value` pairs of a build or release CLI; throws with the usage on anything else. */
export function readFlagPairs(
  argv: readonly string[],
  known: ReadonlySet<string>,
  usage: string,
): ReadonlyMap<string, string> {
  const flags = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index] ?? '';
    const value = argv[index + 1];
    if (!known.has(flag) || value === undefined || value.startsWith('--')) {
      throw new Error(`unexpected argument "${flag}". ${usage}`);
    }
    flags.set(flag, value);
  }
  return flags;
}
