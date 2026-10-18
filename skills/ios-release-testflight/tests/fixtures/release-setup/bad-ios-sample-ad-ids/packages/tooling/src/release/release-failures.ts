// packages/tooling/src/release/release-failures.ts
// The release failure playbook as data: match a failed step's output, then either stop and ask the
// owner (never retry: retries can lock the account or burn build numbers) or apply the named fix.

export type FailureVerdict = {
  readonly id: string;
  /** true: stop the run and send the owner one message with `ownerStep` and `action`. */
  readonly isStop: boolean;
  readonly ownerStep: string | null;
  readonly action: string;
};

type Rule = FailureVerdict & { readonly pattern: RegExp };

const RULES: readonly Rule[] = [
  {
    id: 'keychain-locked',
    pattern: /errSecInternalComponent/,
    isStop: true,
    ownerStep: 'O8',
    action:
      'Unlock the login keychain on the Mac (security unlock-keychain ~/Library/Keychains/login.keychain-db in Terminal), or start the run from the logged-in desktop.',
  },
  {
    id: 'agreement',
    pattern: /agreement|PLA Update available/i,
    isStop: true,
    ownerStep: 'R4',
    action:
      'Accept the new Apple agreement at developer.apple.com and/or App Store Connect > Business, then rerun from the failed step.',
  },
  {
    id: 'app-record-missing',
    pattern:
      /No App Store Connect app record|cannot determine the Apple ID|no suitable application records/i,
    isStop: true,
    ownerStep: 'G2',
    action: 'Create the app record in App Store Connect (My Apps > + > New App), then rerun.',
  },
  {
    id: 'not-authorized',
    pattern: /NOT_AUTHORIZED|\b401\b/,
    isStop: true,
    ownerStep: 'O3',
    action:
      'Check that ASC_KEY_ID and ASC_ISSUER_ID match the key file name and the Mac clock is on network time; if the key was revoked, create a new team key with the Admin role.',
  },
  {
    id: 'forbidden',
    pattern: /FORBIDDEN_ERROR|\b403\b|not allowed to create distribution certificates/i,
    isStop: true,
    ownerStep: 'O3',
    action:
      'Create a team API key with the Admin role (individual or App Manager keys cannot sign).',
  },
  {
    id: 'processing-invalid',
    pattern: /processingState"?\s*[:=]\s*"?(INVALID|FAILED)|build status:?\s*(INVALID|FAILED)/i,
    isStop: true,
    ownerStep: 'R4',
    action:
      "Forward Apple's email about the rejected binary; fix, then rebuild with a new build number.",
  },
  {
    id: 'build-number-reused',
    pattern: /ITMS-90189/,
    isStop: false,
    ownerStep: null,
    action:
      'Never reuse a build number: bump it (release:ios does) and rebuild. Check --build-status first if the earlier upload may have succeeded.',
  },
  {
    id: 'version-not-raised',
    pattern: /ITMS-90062/,
    isStop: false,
    ownerStep: null,
    action: 'Raise version in game.config.ts above the last approved version and rebuild.',
  },
  {
    id: 'purpose-string',
    pattern: /ITMS-90683/,
    isStop: false,
    ownerStep: null,
    action:
      'Add a neutral NSMicrophoneUsageDescription (react-native-audio-api plugin option iosMicrophonePermission, translated through expo.locales) and rebuild with a new build number.',
  },
  {
    id: 'privacy-manifest',
    pattern: /ITMS-9105[36]|ITMS-91061/,
    isStop: false,
    ownerStep: null,
    action:
      "Run npm run audit:privacy, add the missing category and reason to ios.privacyManifests, prebuild, rebuild with a new build number; ask the owner for Apple's email text.",
  },
  {
    id: 'signing-flags',
    pattern:
      /No profiles for '[^']+' were found|Automatic signing is disabled|requires a development team/,
    isStop: false,
    ownerStep: null,
    action:
      'Pass -allowProvisioningUpdates and the three -authenticationKey* flags, and export APPLE_TEAM_ID before prebuild (it becomes DEVELOPMENT_TEAM).',
  },
  {
    id: 'pod-download',
    pattern: /Failed to download|Couldn't connect to server|CDN: trunk/i,
    isStop: false,
    ownerStep: null,
    action: 'No network or a CDN problem: retry once after 5 minutes; never loosen pod versions.',
  },
];

/** The first matching rule, or null for an unknown failure (then read the log and diagnose). */
export function classifyReleaseFailure(output: string): FailureVerdict | null {
  const rule = RULES.find((candidate) => candidate.pattern.test(output));
  if (rule === undefined) {
    return null;
  }
  return { id: rule.id, isStop: rule.isStop, ownerStep: rule.ownerStep, action: rule.action };
}

/** One message to the owner: the step, the exact error line and the one action needed. */
export function stopMessage(step: string, errorLine: string, verdict: FailureVerdict): string {
  const owner = verdict.ownerStep === null ? '' : ` (owner step ${verdict.ownerStep})`;
  return [
    `Release stopped at step "${step}"${owner}.`,
    `Error: ${errorLine.trim()}`,
    `Needed: ${verdict.action}`,
    'I will resume from this step once you confirm. Nothing else was changed.',
  ].join('\n');
}
