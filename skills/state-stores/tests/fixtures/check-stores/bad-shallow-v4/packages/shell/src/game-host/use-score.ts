import { useStore } from 'zustand';
import { shallow } from 'zustand/shallow';

import type { StoreApi } from 'zustand/vanilla';

type Scores = { readonly score: number; readonly best: number };

export function useScores(store: StoreApi<Scores>): Scores {
  return useStore(store, (state) => ({ score: state.score, best: state.best }), shallow);
}
