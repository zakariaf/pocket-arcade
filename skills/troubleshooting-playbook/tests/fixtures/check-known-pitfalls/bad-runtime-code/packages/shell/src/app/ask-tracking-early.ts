// A screen that asks for tracking itself, before the S3 intro and Google's form (planted bug).
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';

export async function askTrackingOnLaunch(): Promise<void> {
  await requestTrackingPermissionsAsync();
}
