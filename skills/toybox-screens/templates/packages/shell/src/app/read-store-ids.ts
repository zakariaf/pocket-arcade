// packages/shell/src/app/read-store-ids.ts
// What the stores know this build by, for the hand-offs to the store (S11's Rate, S14's "please
// update"): the platform picks the store, the App Store id comes from the game config, and the
// Android package (withShell's expo.android.package) is Google Play's id. config/external-links.ts
// turns them into URLs; nothing here goes online.
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { StoreIds } from '@e07/shell/config/external-links.ts';

export function readStoreIds(appStoreId: string | undefined): StoreIds {
  return { os: Platform.OS, appStoreId, androidPackage: Constants.expoConfig?.android?.package };
}
