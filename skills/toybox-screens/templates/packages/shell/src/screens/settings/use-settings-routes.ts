// packages/shell/src/screens/settings/use-settings-routes.ts
// S11's rows that open another screen, exactly as navigation-and-routing's table says. They
// navigate normally in a partial Shell too: a route outside shell-slice.json shows NotBuiltScreen.
import { useNavigation } from '@react-navigation/native';

import type { SettingsExtras } from './settings-extras.ts';

export type SettingsRoutes = Pick<
  SettingsExtras,
  | 'onBack'
  | 'onOpenLanguage'
  | 'onOpenPremium'
  | 'onOpenPrivacyPolicy'
  | 'onOpenAbout'
  | 'onOpenLicences'
>;

export function useSettingsRoutes(): SettingsRoutes {
  const navigation = useNavigation();
  return {
    onBack: () => {
      navigation.goBack();
    },
    onOpenLanguage: () => {
      navigation.navigate('SettingsLanguage');
    },
    onOpenPremium: () => {
      navigation.navigate('Premium');
    },
    onOpenPrivacyPolicy: () => {
      navigation.navigate('PrivacyPolicy');
    },
    onOpenAbout: () => {
      navigation.navigate('About');
    },
    onOpenLicences: () => {
      navigation.navigate('Licences');
    },
  };
}
