// packages/shell/src/i18n/direction.ts
import { reloadAppAsync } from 'expo';

/** Applies the layout direction and reloads the JS bundle (callers dispose audio first). */
export async function restartForDirection(isRtl: boolean): Promise<void> {
  if (isRtl) await reloadAppAsync('direction');
}
