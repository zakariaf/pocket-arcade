// packages/shell/src/app/use-open-external.ts
// The one hand-off to another app (S11's Rate and Contact, S11b's Contact, S11d's licence texts,
// S14's "Update"): the URL comes from config/external-links.ts, the one file allowed to build URLs,
// and iOS opens it in its own app; the Shell itself makes no request (N3). No URL (a game without
// an App Store id yet, a licence without a public text) opens nothing. A failed hand-off is
// logged under 'hand-off', never shown: the player stays where they are.
import { Linking } from 'react-native';

import { useServices } from '@e07/shell/app/services-context.tsx';

/** Call the returned function only from a handler. */
export function useOpenExternal(): (url: string | null) => void {
  const { errorLog } = useServices();
  return (url) => {
    if (url === null) return;
    Linking.openURL(url).catch((error: unknown) => {
      errorLog.record('hand-off', error);
    });
  };
}
