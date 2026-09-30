// apps/tile-drop/src/tutorial/tile-drop-teaching.ts
import { create } from '@e07/tile-drop/rules/create.ts';

/** The tutorial starts from the game's own create(): pure data, not a zustand store. */
export const TUTORIAL_START = create(1, 0);
