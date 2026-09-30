// packages/shell/src/i18n/direction.ts
import * as Updates from 'expo-updates';

export async function restart(): Promise<void> {
  await Updates.reloadAsync();
}
