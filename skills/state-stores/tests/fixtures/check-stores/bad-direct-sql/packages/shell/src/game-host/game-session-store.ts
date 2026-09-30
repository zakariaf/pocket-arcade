import { openDatabaseSync } from 'expo-sqlite';

export function writeRunDirectly(json: string): void {
  openDatabaseSync('save.db').runSync('UPDATE save_slots SET payload = ?', [json]);
}
