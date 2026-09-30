import { View } from 'react-native';

import type { ReactNode } from 'react';

type Pack = { readonly id: string; readonly name: string };

export function PackList({ packs }: { readonly packs: readonly Pack[] }): ReactNode {
  return (
    <View>
      {packs.map(({ name }, packIndex) => (
        <View key={`pack-${String(packIndex)}`} testID={`levels.pack.${name}`} />
      ))}
    </View>
  );
}
