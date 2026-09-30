import { FlatList } from 'react-native';

import type { ReactNode } from 'react';

export function PackList({ ids }: { readonly ids: readonly string[] }): ReactNode {
  return <FlatList data={ids} renderItem={() => null} keyExtractor={(id) => id} />;
}
