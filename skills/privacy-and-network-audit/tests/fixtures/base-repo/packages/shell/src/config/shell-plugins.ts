// packages/shell/src/config/shell-plugins.ts (fixture: the parts the N3 audit reads)
import ckb from '../i18n/catalogs/ckb.json';
import de from '../i18n/catalogs/de.json';
import en from '../i18n/catalogs/en.json';
import fa from '../i18n/catalogs/fa.json';

const KEY = 'consent.tracking.usage-description';
export const TRACKING_USAGE_DESCRIPTIONS = { en: en[KEY], de: de[KEY], fa: fa[KEY], ckb: ckb[KEY] };

export function shellPlugins(): unknown[] {
  return [
    'expo-sqlite',
    'expo-iap',
    ['react-native-google-mobile-ads', { iosAppId: 'from admobPluginOptions' }],
    ['expo-tracking-transparency', { userTrackingPermission: TRACKING_USAGE_DESCRIPTIONS.en }],
  ];
}
