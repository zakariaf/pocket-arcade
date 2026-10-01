// packages/shell/src/services/consent/admob-consent-adapter.ts
// The one file allowed to import expo-tracking-transparency (Apple's ATT prompt, owner decision O1).
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';

/** Apple's tracking prompt, asked after Google's form. */
export async function requestTracking(): Promise<string> {
  const { status } = await requestTrackingPermissionsAsync();
  return status;
}
