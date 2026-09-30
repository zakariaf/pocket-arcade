// packages/shell/src/app/create-shell-app.tsx (fixture: the launch members the composition root runs)
import type { Wiring } from './wiring.ts';

export function createShellAppFixture(w: Wiring): unknown {
  const launch = w.launch ?? {};
  const store = launch.purchasePort?.(w.productId) ?? w.store;
  const ads = launch.adsPort?.() ?? w.ads;
  const initialState = launch.initialState?.() ?? w.resume;
  const isConsentHeld = launch.isConsentMomentHeld?.() ?? false;
  const isLayoutProbeOn = (): boolean => w.boardLayout() || TEST_ONLY?.isParityBoardProbeOn() === true;
  const root = w.root(store, ads, initialState, isConsentHeld, isLayoutProbeOn);
  return launch.wrapRoot?.(root) ?? root;
}
