// packages/tooling/src/deps/banned-packages.test.ts
import { findBannedPackages, inventoryFromLockfile, type Lockfile } from './banned-packages.ts';

const LOCKFILE: Lockfile = {
  packages: {
    '': { devDependencies: { eslint: '9.39.5' } },
    'apps/line-siege': { dependencies: { expo: '~57.0.25', axios: '1.0.0' } },
    'node_modules/expo': {},
    'node_modules/@react-native-community/netinfo': {},
    'node_modules/fbjs/node_modules/cross-fetch': {},
  },
};

describe('inventoryFromLockfile', () => {
  it('separates direct dependencies from everything installed', () => {
    expect(inventoryFromLockfile(LOCKFILE)).toStrictEqual({
      direct: ['axios', 'eslint', 'expo'],
      all: ['@react-native-community/netinfo', 'cross-fetch', 'expo'],
    });
  });
});

describe('findBannedPackages', () => {
  it('reports banned packages anywhere and HTTP clients only when direct', () => {
    const hits = findBannedPackages(inventoryFromLockfile(LOCKFILE));
    expect(hits.map((hit) => hit.name)).toStrictEqual(['@react-native-community/netinfo', 'axios']);
  });

  it('accepts a lockfile without banned packages', () => {
    const clean: Lockfile = { packages: { '': {}, 'node_modules/zustand': {} } };
    expect(findBannedPackages(inventoryFromLockfile(clean))).toStrictEqual([]);
  });

  it('bans the Android SDKs that report to Google or a tracker: Play Integrity, Install Referrer, analytics', () => {
    const android: Lockfile = {
      packages: {
        'apps/line-siege': { dependencies: { 'react-native-google-play-integrity': '1.0.0' } },
        'node_modules/react-native-google-play-integrity': {},
        'node_modules/@expo/app-integrity': {},
        'node_modules/react-native-play-install-referrer': {},
        'node_modules/react-native-install-referrer': {},
        'node_modules/@react-native-firebase/analytics': {},
        'node_modules/expo-firebase-analytics': {},
        'node_modules/react-native-appsflyer': {},
        'node_modules/react-native-adjust': {},
        'node_modules/react-native-fbsdk-next': {},
        'node_modules/mixpanel-react-native': {},
      },
    };
    expect(findBannedPackages(inventoryFromLockfile(android)).map((hit) => hit.name)).toStrictEqual(
      [
        '@react-native-firebase/analytics',
        '@expo/app-integrity',
        'react-native-google-play-integrity',
        'react-native-install-referrer',
        'react-native-play-install-referrer',
        'expo-firebase-analytics',
        'mixpanel-react-native',
        'react-native-adjust',
        'react-native-appsflyer',
        'react-native-fbsdk-next',
      ],
    );
  });

  it('keeps the AdMob and Play Billing wrappers the Shell ships with allowed on Android', () => {
    const shipped: Lockfile = {
      packages: {
        'node_modules/react-native-google-mobile-ads': {},
        'node_modules/expo-iap': {},
        'node_modules/expo-tracking-transparency': {},
      },
    };
    expect(findBannedPackages(inventoryFromLockfile(shipped))).toStrictEqual([]);
  });

  it('allows the App Tracking Transparency module the consent adapter asks with', () => {
    const withAtt: Lockfile = {
      packages: {
        'apps/line-siege': { dependencies: { 'expo-tracking-transparency': '~57.0.2' } },
        'node_modules/expo-tracking-transparency': {},
      },
    };
    expect(findBannedPackages(inventoryFromLockfile(withAtt))).toStrictEqual([]);
  });
});
