// packages/tooling/src/release/release-failures.test.ts
import { classifyReleaseFailure, stopMessage } from './release-failures.ts';

describe('classifyReleaseFailure', () => {
  it.each([
    ['errSecInternalComponent', 'keychain-locked', 'O8'],
    ['You must accept the updated Program License Agreement', 'agreement', 'R4'],
    ['xcodebuild: error: PLA Update available', 'agreement', 'R4'],
    ['No App Store Connect app record for com.example.linesiege.', 'app-record-missing', 'G2'],
    ['App Store Connect answered 401 (NOT_AUTHORIZED)', 'not-authorized', 'O3'],
    ['FORBIDDEN_ERROR: not allowed to create distribution certificates', 'forbidden', 'O3'],
    ['"processingState": "INVALID"', 'processing-invalid', 'R4'],
  ])('stops and asks the owner on "%s"', (output, id, ownerStep) => {
    expect(classifyReleaseFailure(output)).toMatchObject({ id, isStop: true, ownerStep });
  });

  it.each([
    ['ERROR ITMS-90189: "Redundant Binary Upload."', 'build-number-reused'],
    ['ERROR ITMS-90062: version must be higher', 'version-not-raised'],
    ['ITMS-90683: Missing purpose string in Info.plist', 'purpose-string'],
    ['ITMS-91053: Missing API declaration', 'privacy-manifest'],
    ["error: No profiles for 'com.example.linesiege' were found", 'signing-flags'],
  ])('names the agent fix for "%s"', (output, id) => {
    expect(classifyReleaseFailure(output)).toMatchObject({ id, isStop: false, ownerStep: null });
  });

  it('returns null for an unknown failure', () => {
    expect(classifyReleaseFailure('Segmentation fault')).toBeNull();
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
