import { reloadAppAsync } from 'expo';

export async function applyLanguage(): Promise<void> {
  await reloadAppAsync('language');
}
