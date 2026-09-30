// packages/shell/src/i18n/kv-direction-guard.ts
import Storage from 'expo-sqlite/kv-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Direction guard. */
export function readGuard(): unknown {
  return [Storage, AsyncStorage];
}
