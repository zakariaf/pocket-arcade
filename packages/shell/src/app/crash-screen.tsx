// packages/shell/src/app/crash-screen.tsx
import { StyleSheet, View } from 'react-native';
import { useStore } from 'zustand';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { ArtTile } from '@e07/shell/ui/art-tile.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { DialogCard } from '@e07/shell/ui/dialog-card.tsx';
import { ScreenFrame } from '@e07/shell/ui/screen-frame.tsx';

import { systemA11yStore } from './system-a11y-store.ts';

import type { ReactNode } from 'react';

export type CrashScreenProps = { readonly onGoHome: () => void };

const styles = StyleSheet.create({
  // The dialog overlay's spacing (28 block, 20 inline), on the plain ground: nothing to dim.
  overlay: { flex: 1, justifyContent: 'center', paddingBlock: 28, paddingInline: 20 },
});

/**
 * The error boundary's fallback in Toybox dress (Chosen; not drawn): the dialog card with the
 * pop alert art, the gentle message and the one way out. It never retries on its own. It reads
 * Reduce motion from the phone only: the fallback must not depend on the stores that may have
 * failed. DialogCard also derives crash.card, crash.title and crash.body from its base.
 */
export function CrashScreen({ onGoHome }: CrashScreenProps): ReactNode {
  const t = useT();
  const isReducedMotion = useStore(systemA11yStore, (state) => state.isReduceMotionOn);
  return (
    <ScreenFrame testID="crash.screen">
      <View style={styles.overlay}>
        <DialogCard
          testIDBase="crash"
          art={<ArtTile icon="alert" paint="pop" />}
          title={t('dialog.crash.title')}
          body={t('dialog.crash.body')}
        >
          <Button
            testID="crash.home-button"
            label={t('dialog.crash.home-button.label')}
            onPress={onGoHome}
            kind="primary"
            icon="home"
            isBlock
            isReducedMotion={isReducedMotion}
          />
        </DialogCard>
      </View>
    </ScreenFrame>
  );
}
