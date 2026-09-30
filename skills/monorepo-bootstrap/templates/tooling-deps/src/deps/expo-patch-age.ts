// packages/tooling/src/deps/expo-patch-age.ts
// Pure: reads the version mismatches `npx expo install --check` and `npx expo-doctor` print, and
// decides which of them the 7-day release-age rule still forbids to install. A patch release of the
// same major.minor line that is younger than 7 days is a warning with its due date (installing it
// now would break min-release-age=7); from the due date on it is a failure like any other mismatch.
const DAY_MS = 86_400_000;
const RELEASE_AGE_DAYS = 7;
/** "  expo@57.0.25 - expected version: ~57.0.26" (expo install --check). */
const INSTALL_CHECK_LINE = /^\s*(@?[^@\s]+)@(\d+\.\d+\.\d+\S*) - expected version: (\S+)\s*$/;
/** "expo     ~57.0.26  57.0.25" (a row of expo-doctor's version table). */
const DOCTOR_ROW = /^\s*(@?[a-z0-9][\w./-]*)\s+([~^]?\d+\.\d+\.\d+\S*)\s+(\d+\.\d+\.\d+\S*)\s*$/;
/** "✖ Check that packages match versions required by installed Expo SDK". */
const DOCTOR_FAILED_CHECK = /^\s*✖\s+(.+?)\s*$/;
const VERSION_CHECK = 'packages match versions required by installed Expo SDK';

export type VersionMismatch = {
  readonly name: string;
  readonly found: string;
  /** The lowest version the expected range accepts ("~57.0.26" -> "57.0.26"). */
  readonly expected: string;
};

export type YoungPatch = VersionMismatch & {
  readonly publishedIso: string;
  readonly dueIso: string;
};

export type MismatchVerdict =
  | { readonly kind: 'young-patches'; readonly patches: readonly YoungPatch[] }
  | { readonly kind: 'due' };

/** Looks up when a version was published (npm view <name> time), or null when unknown. */
export type PublishTimes = (name: string, version: string) => string | null;

const bare = (spec: string): string => spec.replace(/^[~^=v]+/, '');

function numbers(version: string): readonly number[] {
  return bare(version).split('-')[0]?.split('.').map(Number) ?? [];
}

/** True when expected is a later patch of the same major.minor line as found. */
export function isPatchMove(found: string, expected: string): boolean {
  const [foundMajor, foundMinor, foundPatch] = numbers(found);
  const [major, minor, patch] = numbers(expected);
  return foundMajor === major && foundMinor === minor && (patch ?? 0) > (foundPatch ?? 0);
}

/** The first UTC day that starts at least 7 days after the publish time: the day it is due. */
export function dueDay(publishedIso: string): string {
  const ready = Date.parse(publishedIso) + RELEASE_AGE_DAYS * DAY_MS;
  return new Date(Math.ceil(ready / DAY_MS) * DAY_MS).toISOString().slice(0, 10);
}

/** The mismatches listed in the output of `npx expo install --check`. */
export function parseInstallCheck(output: string): readonly VersionMismatch[] {
  return output.split('\n').flatMap((line) => {
    const match = INSTALL_CHECK_LINE.exec(line);
    return match === null
      ? []
      : [{ name: match[1] ?? '', found: match[2] ?? '', expected: bare(match[3] ?? '') }];
  });
}

/**
 * The mismatches of expo-doctor's version table, or null when another check failed as well (then
 * the output is a real failure whatever the versions say).
 */
export function parseDoctor(output: string): readonly VersionMismatch[] | null {
  const lines = output.split('\n');
  const failed = lines.flatMap((line) => DOCTOR_FAILED_CHECK.exec(line)?.[1] ?? []);
  if (failed.length === 0 || failed.some((check) => !check.includes(VERSION_CHECK))) {
    return null;
  }
  return lines.flatMap((line) => {
    const match = DOCTOR_ROW.exec(line);
    return match === null
      ? []
      : [{ name: match[1] ?? '', expected: bare(match[2] ?? ''), found: match[3] ?? '' }];
  });
}

/**
 * young-patches when every mismatch is a patch release that the release-age rule still forbids
 * today (with the day each one becomes due), otherwise due: install the expected versions.
 */
export function judgeMismatches(
  mismatches: readonly VersionMismatch[] | null,
  publishedAt: PublishTimes,
  todayIso: string,
): MismatchVerdict {
  if (mismatches === null || mismatches.length === 0) {
    return { kind: 'due' };
  }
  const patches: YoungPatch[] = [];
  for (const mismatch of mismatches) {
    const publishedIso = publishedAt(mismatch.name, mismatch.expected);
    if (publishedIso === null || !isPatchMove(mismatch.found, mismatch.expected)) {
      return { kind: 'due' };
    }
    const dueIso = dueDay(publishedIso);
    if (todayIso >= dueIso) {
      return { kind: 'due' };
    }
    patches.push({ ...mismatch, publishedIso, dueIso });
  }
  return { kind: 'young-patches', patches };
}

/** One warning line per young patch, with the day it becomes due. */
export function youngPatchWarnings(
  label: string,
  patches: readonly YoungPatch[],
): readonly string[] {
  return patches.map(
    (patch) =>
      `WARN ${label}: ${patch.name} ${patch.expected} (found ${patch.found}) was published ` +
      `${patch.publishedIso.slice(0, 10)}; min-release-age=7 refuses it until ${patch.dueIso}, so ` +
      `this mismatch is a warning until then and fails from ${patch.dueIso} on (then run ` +
      `npx expo install ${patch.name}@~${patch.expected} in every app and move its versions-table ` +
      `row and any root override in the same commit)`,
  );
}
