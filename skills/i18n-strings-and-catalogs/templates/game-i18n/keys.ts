// apps/__GAME_ID__/src/i18n/keys.ts
// Optional: the game's message ids as typed tables of plain literals (pure data, no import, so any
// game file may use it, rules/ and levels/ included). They reach the Shell through the GameModule
// like every other game text, and the Shell shows each one with gameMessageText(t, { id }) from
// packages/shell/src/i18n/game-message-text.ts, the one place a game id becomes a key t() accepts.
// Never wrap these ids in asGameKey. Keep only the tables the game imports: knip fails on an unused
// file or export. check-i18n-code looks every literal up in the game catalog next to this file,
// which comes from the copy deck: node <skill>/scripts/copy-deck.mjs apply . --game __GAME_ID__
// __LOSE_SLUG__ names what happened when the run is lost, in kebab words (line-siege: broke-through,
// flock-tilt: wolf-got-sheep, scrap-shove: caught; out-of-moves for a game the deck lacks). A game
// with more ways of losing adds one '__GAME_ID__.lose.<slug>' key per way (Line Siege: board-full).

/** Single texts shown by the Shell (S1, S4, S7, S11b, S13). */
export const GAME_TEXT_IDS = {
  name: '__GAME_ID__.name',
  tagline: '__GAME_ID__.tagline',
  goal: '__GAME_ID__.goal',
  progress: '__GAME_ID__.progress',
  winTitle: '__GAME_ID__.win-title',
  loseReason: '__GAME_ID__.lose.__LOSE_SLUG__',
} as const;

/** Level pack names, in pack order (S8). */
export const PACK_NAME_IDS = [
  '__GAME_ID__.pack-name.1',
  '__GAME_ID__.pack-name.2',
  '__GAME_ID__.pack-name.3',
] as const;

/** How-to-play steps (S13), in order. */
export const HOW_TO_PLAY_IDS = [
  '__GAME_ID__.how-to-play.step-1',
  '__GAME_ID__.how-to-play.step-2',
  '__GAME_ID__.how-to-play.step-3',
  '__GAME_ID__.how-to-play.step-4',
] as const;

/** First-level tutorial one-liners, in order. */
export const TUTORIAL_IDS = [
  '__GAME_ID__.tutorial.step-1',
  '__GAME_ID__.tutorial.step-2',
  '__GAME_ID__.tutorial.step-3',
  '__GAME_ID__.tutorial.step-4',
] as const;
