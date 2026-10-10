// packages/shell/src/screens/settings/about/use-about-model.ts
// S11b's model hook: the game's logo, name and tagline from the host, the version line
// (readVersionText), the support address from the game config, Contact through the mail app
// (useSettingsLinks, the same hand-off as S11's row) and Licences through navigation.
import { useNavigation } from '@react-navigation/native';

import { readVersionText } from '@e07/shell/app/read-version-text.ts';
import { useGameExtra } from '@e07/shell/app/use-game-extra.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { useSettingsLinks } from '@e07/shell/screens/settings/use-settings-links.ts';

import type { AboutModel } from './about-view.tsx';

export function useAboutModel(): AboutModel {
  const t = useT();
  const navigation = useNavigation();
  const host = useGameHost();
  const versionText = readVersionText();
  return {
    logo: host.logo,
    gameName: gameMessageText(t, { id: host.nameId }),
    tagline: gameMessageText(t, { id: host.taglineId }),
    versionText,
    emailText: useGameExtra().links.supportEmail,
    isReducedMotion: useReduceMotion(),
    onBack: () => {
      navigation.goBack();
    },
    onContact: useSettingsLinks(versionText).onContact,
    onOpenLicences: () => {
      navigation.navigate('Licences');
    },
  };
}
