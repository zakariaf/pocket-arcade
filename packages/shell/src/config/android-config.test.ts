// packages/shell/src/config/android-config.test.ts
import {
  ANDROID_PERMISSIONS,
  androidConfig,
  androidPlugins,
  BLOCKED_ANDROID_PERMISSIONS,
} from './android-config.ts';

import type { GameConfig } from './game-config.ts';

const GAME: GameConfig = {
  id: 'probe-game',
  appName: { en: 'Probe Game', de: 'Probe Game', fa: 'Probe Game', ckb: 'Probe Game' },
  bundleId: 'io.applander.probegame',
  appStoreId: null,
  version: '1.0.0',
  buildNumber: 7,
  premium: { productId: 'io.applander.probegame.premium', priceNote: 'EUR 1.99 (owner, O2)' },
  ads: {
    isEnabled: true,
    policy: {
      minLevelsCompletedBeforeFirst: 3,
      minMsBetweenInterstitials: 180_000,
      minLevelsCompletedBetween: 2,
    },
    ids: {
      ios: {
        appId: 'ca-app-pub-1234567890123456~1234567890',
        units: {
          banner: 'ca-app-pub-1234567890123456/1111111111',
          interstitial: 'ca-app-pub-1234567890123456/2222222222',
          rewarded: 'ca-app-pub-1234567890123456/3333333333',
        },
      },
      android: null,
    },
  },
  modes: { daily: true, endless: false },
  levels: { packCount: 3, levelsPerPack: 30 },
  hints: { freePerDay: 1 },
  isContinueAllowed: true,
  links: {
    privacyPolicy: { host: 'example.com', path: '/probe-game/privacy' },
    supportEmail: 'support@example.com',
  },
  store: { audience: 'general', ageRating: { advertising: true } },
};

describe('androidConfig', () => {
  it('writes the package, the shared build number as versionCode, backup, permissions and dark mode', () => {
    expect(androidConfig(GAME)).toStrictEqual({
      package: 'io.applander.probegame',
      versionCode: 7,
      allowBackup: true,
      permissions: ['android.permission.INTERNET', 'android.permission.VIBRATE'],
      blockedPermissions: [...BLOCKED_ANDROID_PERMISSIONS],
      userInterfaceStyle: 'automatic',
    });
  });

  it("blocks the Expo template's extra permissions and the ones no Pocket Arcade app uses (N3)", () => {
    for (const permission of [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.RECORD_AUDIO',
      'android.permission.CAMERA',
      'android.permission.ACCESS_WIFI_STATE',
    ]) {
      expect(BLOCKED_ANDROID_PERMISSIONS).toContain(permission);
    }
    for (const permission of ANDROID_PERMISSIONS) {
      expect(BLOCKED_ANDROID_PERMISSIONS).not.toContain(permission);
    }
  });
});

describe('androidPlugins', () => {
  it('lists the backup rules, right-to-left support, the prepared text layout and the upload signing for this game', () => {
    expect(androidPlugins(GAME)).toStrictEqual([
      '@e07/shell/plugins/with-backup-rules.ts',
      '@e07/shell/plugins/with-rtl-support.ts',
      '@e07/shell/plugins/with-prepared-text-layout.ts',
      ['@e07/shell/plugins/with-upload-signing.ts', { game: 'probe-game' }],
    ]);
  });
});
