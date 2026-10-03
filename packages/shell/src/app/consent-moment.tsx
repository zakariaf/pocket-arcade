// packages/shell/src/app/consent-moment.tsx
// S3, the consent moment (spec S3, 8.8), mounted once in ShellFeatures around the navigator. It
// provides the ad hooks their moment and the live consent answer, and draws toybox-screens'
// ConsentIntroScreen full screen over the app while the flow asks for it: where Google's form is
// required, after the tutorial, online, not Premium, over a banner screen, before the first ad.
// The cover is a modal layer, so it draws the parity launch marker first (nothing outside a parity
// capture): the held S3 frame's hierarchy then proves which launch it came from.
import { StyleSheet, View } from 'react-native';

import { ConsentMomentContext } from '@e07/shell/app/consent-moment-context.tsx';
import { ParityLaunchMarker } from '@e07/shell/app/parity-launch-marker.tsx';
import { useConsentMoment } from '@e07/shell/app/use-consent-moment.ts';
import { ConsentIntroScreen } from '@e07/shell/screens/consent/consent-intro-screen.tsx';

import type { ConsentMomentOptions } from '@e07/shell/app/use-consent-moment.ts';
import type { ReactNode } from 'react';

export type ConsentMomentProps = ConsentMomentOptions & { readonly children: ReactNode };

const styles = StyleSheet.create({ cover: StyleSheet.absoluteFill });

export function ConsentMoment({ children, ...options }: ConsentMomentProps): ReactNode {
  const model = useConsentMoment(options);
  return (
    <ConsentMomentContext value={model.value}>
      {children}
      {model.isIntroShown ? (
        <View style={styles.cover} accessibilityViewIsModal>
          <ParityLaunchMarker />
          <ConsentIntroScreen
            onContinue={model.onContinue}
            isReducedMotion={model.isReducedMotion}
          />
        </View>
      ) : null}
    </ConsentMomentContext>
  );
}
