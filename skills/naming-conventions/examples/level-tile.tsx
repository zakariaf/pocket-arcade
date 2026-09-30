// packages/shell/src/ui/level-tile.tsx
// Naming illustration: component named after its file, <Component>Props, a prefixed boolean prop,
// an onX callback prop, a handleX handler and a testID with a stable data key. (The real Levels
// tile is the Toybox LevelTile, pressed through RaisedSurface; this file only illustrates names.)
import { Pressable } from 'react-native';

import { AppText } from '@e07/shell/ui/app-text.tsx';

export type LevelTileProps = {
  readonly level: number;
  readonly label: string;
  readonly a11yLabel: string;
  readonly isLocked: boolean;
  readonly onSelect: (level: number) => void;
};

/** One tile of the Levels grid (spec S8). Text arrives translated from the screen. */
export function LevelTile({
  level,
  label,
  a11yLabel,
  isLocked,
  onSelect,
}: LevelTileProps): React.JSX.Element {
  const handlePress = (): void => {
    onSelect(level);
  };
  return (
    <Pressable
      role="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: isLocked }}
      testID={`levels.level-tile.${String(level)}`}
      onPress={handlePress}
    >
      <AppText text={label} />
    </Pressable>
  );
}
