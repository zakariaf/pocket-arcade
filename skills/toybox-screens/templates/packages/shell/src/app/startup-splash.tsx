// packages/shell/src/app/startup-splash.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { BusyBlocks } from '@e07/shell/ui/busy-blocks.tsx';
import { LogoTile } from '@e07/shell/ui/logo-tile.tsx';
import { ScreenFrame } from '@e07/shell/ui/screen-frame.tsx';

import type { LogoArt } from '@e07/shell/art/logo-art.ts';
import type { ReactNode } from 'react';

export type StartupSplashProps = {
  /** The module's GAME_ART.logo (useGameHost().logo; the restart splash reads the module). */
  readonly logo: LogoArt;
  /** games.<id>.name: Latin in every language, isolated by AppText. */
  readonly gameName: string;
  /** games.<id>.tagline in the UI language. */
  readonly tagline: string;
  readonly isReducedMotion: boolean;
};

const styles = StyleSheet.create({
  column: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 },
  name: { marginTop: 8 },
  tagline: { maxWidth: 290 },
  loader: { alignItems: 'center', paddingBottom: 44 },
});

/**
 * S1. The native splash covers normal launches; this view shows only while the Shell restarts
 * for a direction change, and it draws the same logo on the same ground so the hand-off is seamless.
 */
export function StartupSplash({
  logo,
  gameName,
  tagline,
  isReducedMotion,
}: StartupSplashProps): ReactNode {
  const t = useT();
  const theme = useTheme();
  return (
    <ScreenFrame testID="splash.screen">
      <View style={styles.column}>
        <LogoTile testID="splash.logo" logo={logo} variant="splash" />
        <View style={styles.name}>
          <AppText
            text={gameName}
            variant="gameNameSplash"
            align="center"
            isHeader
            testID="splash.game-name"
          />
        </View>
        <View style={styles.tagline}>
          <AppText
            text={tagline}
            variant="splashTagline"
            tone="muted"
            align="center"
            testID="splash.tagline"
          />
        </View>
      </View>
      <View style={styles.loader}>
        <BusyBlocks
          size="splash"
          color={theme.colors.icon}
          label={t('splash.loading.a11y-label', { gameName })}
          isReducedMotion={isReducedMotion}
          testID="splash.loader"
        />
      </View>
    </ScreenFrame>
  );
}
