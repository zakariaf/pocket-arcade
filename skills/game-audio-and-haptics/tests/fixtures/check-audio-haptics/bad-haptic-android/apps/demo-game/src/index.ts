// apps/demo-game/src/index.ts
import { SOUND_BANK } from './sounds/sound-bank.ts';

/** The game module handed to startShell (other members omitted in this fixture). */
export const DEMO_PRESENTATION = { sounds: SOUND_BANK } as const;
