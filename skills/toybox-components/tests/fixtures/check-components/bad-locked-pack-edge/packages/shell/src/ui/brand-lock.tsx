// packages/shell/src/ui/brand-lock.tsx
import { StyleSheet, View } from 'react-native';

import { SPACING } from '@e07/shell/theme/tokens.ts';

import { AppText } from './app-text.tsx';

import type { ReactNode } from 'react';

/** Logo to name 12 pt; name to badge 6 pt (the brand-lock CSS). */
const NAME_GAP = 6;

export type BrandLockProps = {
  /** The game's LogoTile (variant home, 46 pt). */
  readonly logo: ReactNode;
  /** The game name: a brand, never translated; AppText isolates it LTR. */
  readonly gameName: string;
  /** `home.brand-lock`; the name is `home.game-name`. */
  readonly testID: string;
  readonly nameTestID: string;
  /** Premium owners: the xs gold Premium sticker under the name. */
  readonly badge?: ReactNode;
};

const styles = StyleSheet.create({
  lock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  column: { flexShrink: 1, alignItems: 'flex-start', gap: NAME_GAP },
});

/** Home's top-bar start: logo tile, game name (Lilita One, +0.01 em) and the Premium badge. */
export function BrandLock({
  logo,
  gameName,
  testID,
  nameTestID,
  badge,
}: BrandLockProps): ReactNode {
  return (
    <View style={styles.lock} testID={testID}>
      {logo}
      <View style={styles.column}>
        <AppText text={gameName} variant="gameNameHome" isHeader testID={nameTestID} />
        {badge}
      </View>
    </View>
  );
}
