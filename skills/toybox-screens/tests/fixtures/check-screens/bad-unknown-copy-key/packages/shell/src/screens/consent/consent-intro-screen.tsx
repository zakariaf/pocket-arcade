// packages/shell/src/screens/consent/consent-intro-screen.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { ArtTile } from '@e07/shell/ui/art-tile.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { NotePanel } from '@e07/shell/ui/note-panel.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame } from '@e07/shell/ui/screen-frame.tsx';

import type { ReactNode } from 'react';

export type ConsentIntroScreenProps = {
  /** Opens Google's UMP form through the consent port. */
  readonly onContinue: () => void;
  readonly isReducedMotion: boolean;
};

const styles = StyleSheet.create({
  grow: { flexGrow: 1 },
  art: { alignSelf: 'flex-start' },
});

/**
 * S3 consent moment: the Shell's own screen right before Google's consent form. Not a route:
 * the consent flow shows it full screen, only where consent is required, after the tutorial
 * and before the first ad request. Google draws the form itself; the Shell never imitates it.
 */
export function ConsentIntroScreen({
  onContinue,
  isReducedMotion,
}: ConsentIntroScreenProps): ReactNode {
  const t = useT();
  return (
    <ScreenFrame testID="consent.screen">
      <ScreenBody>
        <View style={styles.grow} />
        <View style={styles.art}>
          <ArtTile testID="consent.art" icon="shield" paint="gold" />
        </View>
        <AppText text={t('consent.intro.titel')} variant="title" isHeader testID="consent.title" />
        <AppText text={t('consent.intro.body')} variant="lead" testID="consent.body" />
        <NotePanel testID="consent.detail-note" icon="info" text={t('consent.intro.detail')} />
        <View style={styles.grow} />
        <Button
          testID="consent.continue-button"
          label={t('consent.intro.continue-button')}
          onPress={onContinue}
          kind="primary"
          size="hero"
          iconEnd="forward"
          isBlock
          isReducedMotion={isReducedMotion}
        />
        <AppText
          text={t('consent.intro.footnote')}
          variant="caption"
          tone="muted"
          testID="consent.footnote"
        />
      </ScreenBody>
    </ScreenFrame>
  );
}
