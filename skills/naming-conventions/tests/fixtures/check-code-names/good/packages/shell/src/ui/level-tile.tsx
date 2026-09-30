// packages/shell/src/ui/level-tile.tsx
import { AppText } from '@demo/shell/ui/app-text.tsx';

export type LevelTileProps = {
  readonly level: number;
  readonly label: string;
  readonly isLocked: boolean;
  readonly onSelect: (level: number) => void;
};

/** One tile of the Levels grid. */
export function LevelTile({ level, label, isLocked, onSelect }: LevelTileProps): React.JSX.Element {
  const handlePress = (): void => {
    onSelect(level);
  };
  return (
    <Pressable
      role="button"
      accessibilityState={{ disabled: isLocked }}
      testID={`levels.level-tile.${String(level)}`}
      onPress={handlePress}
    >
      <AppText text={label} testID="levels.level-tile-label" />
    </Pressable>
  );
}
