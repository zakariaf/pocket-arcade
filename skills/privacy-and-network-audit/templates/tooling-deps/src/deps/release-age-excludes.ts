// packages/tooling/src/deps/release-age-excludes.ts
// Pure: .npmrc keeps the release-age policy, and every min-release-age exclude sits in a dated,
// unexpired block. npm keeps the LAST value of a key and accepts "key = value" and "key=value" alike,
// so a later "min-release-age=0" or an exclude spelled without "[]" must not slip through.
const POLICY_LINE = /^min-release-age=7$/m;
const POLICY: Readonly<Record<string, string>> = {
  'min-release-age': '7',
  'engine-strict': 'true',
  'save-exact': 'true',
};
const SETTING = /^\s*([^\s=#;][^\s=]*)\s*=\s*(.*?)\s*$/;
const EXCLUDE_KEY = /^min-release-age-exclude(\[\])?$/;
const BLOCK_HEADER = /^# exclude-block expires=(\d{4}-\d{2}-\d{2}) reason=\S.*$/;

export type ExcludeProblem = 'policy-missing' | 'policy-overridden' | 'no-block' | 'expired';
export type ExcludeViolation = {
  readonly line: number;
  readonly pattern: string;
  readonly problem: ExcludeProblem;
};

type Setting = { readonly key: string; readonly value: string };

function parseSetting(text: string): Setting | null {
  const match = SETTING.exec(text);
  return match === null ? null : { key: match[1] ?? '', value: match[2] ?? '' };
}

/** Lines that set a policy key to another value (they switch the policy off). */
function policyOverrides(lines: readonly string[]): ExcludeViolation[] {
  return lines.flatMap((text, index) => {
    const setting = parseSetting(text);
    const wanted = setting === null ? undefined : POLICY[setting.key];
    return wanted === undefined || setting?.value === wanted
      ? []
      : [{ line: index + 1, pattern: text.trim(), problem: 'policy-overridden' as const }];
  });
}

/** Lists every exclude that is outside a dated block or past its expiry, and a missing policy. */
export function checkReleaseAgeExcludes(npmrc: string, todayIso: string): ExcludeViolation[] {
  const lines = npmrc.split('\n');
  const violations: ExcludeViolation[] = POLICY_LINE.test(npmrc)
    ? []
    : [{ line: 0, pattern: '', problem: 'policy-missing' }];
  violations.push(...policyOverrides(lines));
  let expires: string | null = null;
  lines.forEach((text, index) => {
    const header = BLOCK_HEADER.exec(text);
    const setting = parseSetting(text);
    if (header !== null) {
      expires = header[1] ?? null;
    } else if (text.trim() === '') {
      expires = null;
    } else if (setting !== null && EXCLUDE_KEY.test(setting.key)) {
      const pattern = setting.value;
      if (expires === null) {
        violations.push({ line: index + 1, pattern, problem: 'no-block' });
      } else if (expires < todayIso) {
        violations.push({ line: index + 1, pattern, problem: 'expired' });
      }
    }
  });
  return violations;
}
