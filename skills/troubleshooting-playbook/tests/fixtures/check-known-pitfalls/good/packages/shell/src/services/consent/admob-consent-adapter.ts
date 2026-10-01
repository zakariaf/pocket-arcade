// packages/shell/src/services/consent/admob-consent-adapter.ts (excerpt): the one place that asks.
import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } from 'expo-tracking-transparency';

export async function askTracking(): Promise<string> {
  const current = await getTrackingPermissionsAsync();
  return current.status === 'undetermined' ? (await requestTrackingPermissionsAsync()).status : current.status;
}
