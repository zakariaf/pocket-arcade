// packages/tooling/src/release/release-failures.test.ts
import { classifyReleaseFailure, resumeHint, stopMessage } from './release-failures.ts';

describe('classifyReleaseFailure', () => {
  it.each([
    ['errSecInternalComponent', 'keychain-locked', 'O8'],
    ['You have not agreed to the Xcode license agreements.', 'xcode-license', 'O4'],
    ['You must accept the updated Program License Agreement', 'agreement', 'R4'],
    ['xcodebuild: error: PLA Update available', 'agreement', 'R4'],
    ['No App Store Connect app record for io.applander.linesiege.', 'app-record-missing', 'G2'],
    ['App Store Connect answered 401 (NOT_AUTHORIZED)', 'not-authorized', 'O3'],
    ['FORBIDDEN_ERROR: not allowed to create distribution certificates', 'forbidden', 'O3'],
    ['"processingState": "INVALID"', 'processing-invalid', null],
  ])('stops and asks the owner on "%s"', (output, id, ownerStep) => {
    expect(classifyReleaseFailure(output)).toMatchObject({ id, isStop: true, ownerStep });
  });

  it('quotes the line that matched, not the last line of the log', () => {
    const log = 'CodeSign LineSiege.app\nerrSecInternalComponent\n** ARCHIVE FAILED **\n';
    expect(classifyReleaseFailure(log)?.line).toBe('errSecInternalComponent');
  });

  it('does not read a bare 401 or 403 in a build log as an Apple answer', () => {
    expect(classifyReleaseFailure('ld: warning: 401 duplicate symbols, 403 files')).toBeNull();
  });

  it.each([
    ['ERROR ITMS-90189: "Redundant Binary Upload."', 'build-number-reused'],
    ['ERROR ITMS-90062: version must be higher', 'version-not-raised'],
    ['ITMS-90683: Missing purpose string in Info.plist', 'purpose-string'],
    ['ITMS-91053: Missing API declaration', 'privacy-manifest'],
    ["error: No profiles for 'io.applander.linesiege' were found", 'signing-flags'],
  ])('names the agent fix for "%s"', (output, id) => {
    expect(classifyReleaseFailure(output)).toMatchObject({ id, isStop: false, ownerStep: null });
  });

  it('returns null for an unknown failure', () => {
    expect(classifyReleaseFailure('Segmentation fault')).toBeNull();
  });
});

describe('resumeHint', () => {
  it.each([
    ['verify', 'rerun the same release:ios command'],
    ['archive', '--resume build'],
    ['upload', '--resume processing'],
  ])('tells the agent how to rerun after a failure in "%s"', (step, hint) => {
    expect(resumeHint(step)).toContain(hint);
  });
});

describe('stopMessage', () => {
  it('names the step, the error line and the one action', () => {
    const verdict = classifyReleaseFailure('errSecInternalComponent');
    expect(verdict).not.toBeNull();
    const message = stopMessage(
      'archive',
      'errSecInternalComponent\n',
      verdict ?? { id: '', isStop: true, ownerStep: null, action: '' },
    );
    expect(message).toContain('Release stopped at step "archive" (owner step O8).');
    expect(message).toContain('Error: errSecInternalComponent');
  });
});
