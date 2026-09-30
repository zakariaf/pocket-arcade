// packages/shell/src/screens/home/home-buttons.tsx
/** Buttons. */
export function HomeButtons({ items }: { readonly items: readonly string[] }): React.JSX.Element {
  return (
    <View testID="HomePlay">
      <View testID={'home_play'} />
      {items.map((item, index) => (
        <View key={item} testID={`levels.levelTile.${item}`} />
      ))}
      {items.map((item, index) => (
        <View key={item} testID={`levels.level-tile.${String(index)}`} />
      ))}
    </View>
  );
}
