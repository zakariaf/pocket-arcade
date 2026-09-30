// apps/demo-game/src/board/shake.ts
import { impactAsync } from 'expo-haptics';

export const shake = (): Promise<void> => impactAsync();
