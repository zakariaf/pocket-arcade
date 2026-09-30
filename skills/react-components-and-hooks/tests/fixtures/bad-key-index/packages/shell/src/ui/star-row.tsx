import { View } from 'react-native';

import type { ReactNode } from 'react';

export function StarRow({ stars }: { readonly stars: readonly number[] }): ReactNode {
  return (
    <View>
      {stars.map((star, index) => (
        <View key={index} testID={`star.${String(star)}`} />
      ))}
    </View>
  );
}
