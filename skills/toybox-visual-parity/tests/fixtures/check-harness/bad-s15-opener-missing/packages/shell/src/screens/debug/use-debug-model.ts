// packages/shell/src/screens/debug/use-debug-model.ts (fixture: S15's model hook draws the switches but never opens its frame state, so the capture shows "Always show test ads" off)
export function useDebugSwitches(adsOverride: 'always-test' | 'never' | null): Readonly<Record<string, boolean>> {
  return { 'ads-always-test': adsOverride === 'always-test', 'ads-never': adsOverride === 'never' };
}
