// packages/shell/src/screens/settings/licences/use-licences-model.ts
// S11d's model hook: the Shell's own rows (shellLicenceEntries) followed by the game's credits
// (creditRowsOf(useGameHost().credits): word lists, an extra font, sound sources). The app bundles
// no licence documents and makes no request of its own, so "Show licence text" hands the
// licence's public text to the browser (licenceTextUrl in config/external-links.ts); a row without
// one opens nothing. A failed hand-off is logged, never shown.
import { useNavigation } from '@react-navigation/native';
import { Linking } from 'react-native';

import { useServices } from '@e07/shell/app/services-context.tsx';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { creditRowsOf } from '@e07/shell/art/credit-rows.ts';
import { licenceTextUrl } from '@e07/shell/config/external-links.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';

import { shellLicenceEntries } from './licence-entries.ts';

import type { LicenceEntry } from './licence-entries.ts';
import type { LicencesModel } from './licences-view.tsx';

export function useLicencesModel(): LicencesModel {
  const t = useT();
  const navigation = useNavigation();
  const host = useGameHost();
  const { errorLog } = useServices();
  const entries: readonly LicenceEntry[] = [
    ...shellLicenceEntries(t),
    ...creditRowsOf(host.credits),
  ];
  return {
    gameName: gameMessageText(t, { id: host.nameId }),
    entries,
    isReducedMotion: useReduceMotion(),
    onBack: () => {
      navigation.goBack();
    },
    onShowText: (key) => {
      const entry = entries.find((each) => each.key === key);
      const url = entry === undefined ? null : licenceTextUrl(entry.licence);
      if (url === null) return;
      Linking.openURL(url).catch((error: unknown) => {
        errorLog.record('boot', error);
      });
    },
  };
}
