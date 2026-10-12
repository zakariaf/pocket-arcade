// packages/shell/src/app/use-open-external.ts
// The one hand-off to another app (S11's Rate and Contact, S11b's Contact, S11d's licence texts,
// S14's "Update"): the URL comes from config/external-links.ts, the one file allowed to build URLs,
// and the phone opens it in its own app; the Shell itself makes no request (N3). No URL (a game
// without a store id yet, a licence without a public text) opens nothing. A list is tried in
// order until one opens (Android: Google Play's market: page, then its web page on a phone without
// the Play Store). A failed hand-off is logged under 'hand-off', never shown: the player stays
// where they are.
import { Linking } from 'react-native';

import { useServices } from '@e07/shell/app/services-context.tsx';

/** Opens the first URL an app takes; rejects with the last failure when none does. */
async function openFirst(urls: readonly string[]): Promise<void> {
  const [url, ...rest] = urls;
  if (url === undefined) return;
  try {
    await Linking.openURL(url);
  } catch (error: unknown) {
    if (rest.length === 0) throw error;
    await openFirst(rest);
  }
}

/** Call the returned function only from a handler. */
export function useOpenExternal(): (url: string | readonly string[] | null) => void {
  const { errorLog } = useServices();
  return (url) => {
    if (url === null) return;
    openFirst(typeof url === 'string' ? [url] : url).catch((error: unknown) => {
      errorLog.record('hand-off', error);
    });
  };
}
