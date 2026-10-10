// packages/shell/src/config/privacy-manifest.test.ts
import { PRIVACY_MANIFESTS } from './privacy-manifest.ts';

const declared = (category: string): readonly string[] =>
  PRIVACY_MANIFESTS.NSPrivacyAccessedAPITypes.find(
    (api) => api.NSPrivacyAccessedAPIType === `NSPrivacyAccessedAPICategory${category}`,
  )?.NSPrivacyAccessedAPITypeReasons ?? [];

describe('PRIVACY_MANIFESTS (the app manifest withShell embeds)', () => {
  it('declares every reason a linked pod declares, the development pods included', () => {
    // audit:privacy on line-siege (2026-10-04): Google's ad pods, React Native's pods and the
    // Expo modules' own manifests; expo-file-system adds 0A2A.1, 3B52.1 and 85F4.1.
    expect(declared('UserDefaults')).toStrictEqual(['CA92.1']);
    expect(declared('FileTimestamp')).toStrictEqual(['C617.1', '0A2A.1', '3B52.1']);
    expect(declared('SystemBootTime')).toStrictEqual(['35F9.1']);
    expect(declared('DiskSpace')).toStrictEqual(['E174.1', '85F4.1']);
  });

  it('declares no tracking and no tracking domains (owner decision O1)', () => {
    expect(PRIVACY_MANIFESTS.NSPrivacyTracking).toBe(false);
    expect(Object.keys(PRIVACY_MANIFESTS)).not.toContain('NSPrivacyTrackingDomains');
  });
});
