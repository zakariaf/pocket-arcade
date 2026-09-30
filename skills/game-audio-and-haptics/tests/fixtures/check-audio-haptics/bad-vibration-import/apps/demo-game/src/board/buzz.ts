// apps/demo-game/src/board/buzz.ts
import { Vibration } from 'react-native';

export const buzz = (): void => Vibration.vibrate(20);
