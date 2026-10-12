// packages/shell/src/app/backup-off.ts
import { AndroidConfig, withAndroidManifest } from '@expo/config-plugins';

export const backupOff = (config: object): object =>
  withAndroidManifest(config, (next) => {
    AndroidConfig.Manifest.getMainApplicationOrThrow(next.modResults);
    return next;
  });
