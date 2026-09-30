import { openDatabaseSync } from 'expo-sqlite';

export function readBest(): unknown {
  return openDatabaseSync('save.db').getFirstSync('SELECT payload FROM save_slots');
}
