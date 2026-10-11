// packages/shell/src/screens/premium/premium-active-sticker.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { Sticker } from '@e07/shell/ui/sticker.tsx';

import type { ReactNode } from 'react';

export type PremiumActiveStickerProps = { readonly isReducedMotion: boolean };

const styles = StyleSheet.create({ sticker: { alignSelf: 'flex-start' } });

/** The slapped "Premium – active" sticker at the start, on the success and the owned page. */
export function PremiumActiveSticker({ isReducedMotion }: PremiumActiveStickerProps): ReactNode {
  const t = useT();
  return (
    <View style={styles.sticker}>
      <Sticker
        testID="premium.active-sticker"
        text={t('premium.active')}
        icon="crown"
        tiltDeg={-3}
        slapDelayMs={0}
        isReducedMotion={isReducedMotion}
      />
    </View>
  );
}
