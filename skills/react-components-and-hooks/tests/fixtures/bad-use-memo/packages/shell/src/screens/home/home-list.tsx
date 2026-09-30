import { useMemo } from 'react';

import type { ReactNode } from 'react';

export function HomeList({ items }: { readonly items: readonly string[] }): ReactNode {
  const sorted = useMemo(() => [...items].sort(), [items]);
  return sorted.length;
}
