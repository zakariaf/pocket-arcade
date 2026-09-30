# Worked example: a counted message a game needs and the deck lacks

Task: VoiceOver reads Line Siege's board as one sentence, "3 monsters in the lanes, 2 hearts left". The copy deck has no such text, so it is written here in all four languages, handed to the Shell the way every game text is, tested through the real catalogs, and checked. (The test and the catalogs below passed in the project workspace; the key is one of Line Siege's four extras listed in the translation-workflow reference.)

## 1. Look for an existing key

```sh
node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs keys --game line-siege
```

The deck has `line-siege.progress` ("Monsters {defeated, number} / {total, number}") for the HUD, but nothing that describes the board, so a new game key is needed.

## 2. Name the key

Game key, place then role: `line-siege.board.summary` (3 segments, kebab-case, starts with the game id).

## 3-4. Write the four languages

A number followed by a counted noun is a plural with `one` and `other` in every language, one plural per count. Persian and Sorani keep the noun singular in both forms; German "Monster" is the same in both.

```json
// apps/line-siege/src/i18n/en.json (added, keys kept sorted)
"line-siege.board.summary": "{monstersCount, plural, one {# monster} other {# monsters}} in the lanes, {heartsCount, plural, one {# heart} other {# hearts}} left",
// de.json
"line-siege.board.summary": "{monstersCount, plural, one {# Monster} other {# Monster}} auf den Bahnen, {heartsCount, plural, one {# Herz} other {# Herzen}} übrig",
// fa.json
"line-siege.board.summary": "{monstersCount, plural, one {# هیولا} other {# هیولا}} در مسیرها، {heartsCount, plural, one {# قلب} other {# قلب}} باقی مانده",
// ckb.json
"line-siege.board.summary": "{monstersCount, plural, one {# دێو} other {# دێو}} لە ڕێڕەوەکاندا، {heartsCount, plural, one {# دڵ} other {# دڵ}} ماوە",
```

(The `//` lines only label the files here; JSON has no comments.)

What the checker would reject, and why:

| Wrong | Rule |
|---|---|
| `"{monstersCount, number} monsters in the lanes, …"` | L6: a number followed by a word must be a plural |
| `"{count} monsters …"` | L4: a plain `{x}` prints Latin digits in every language |
| `"3 monsters in the lanes"` | L7: literal digits |
| fa with only `other {…}` | L5: `one` and `other` in every language |
| `=0 {No monsters}` in en only | P4: Persian puts 0 in `one`, so `=0` must exist in all four |
| `"line-siege.board.summary": "…"` missing in ckb | P1 |
| two keys glued together (`…monsters-count` + `…hearts-left`) | one sentence, one key |

## 5. Hand it to the Shell

The game's code is pure (it cannot import the Shell), so the text travels as the game-kit contract's `Message`: a literal id plus its values. The board module's `describe(view)` returns it:

```ts
// apps/line-siege/src/board/line-siege-board.ts (excerpt)
describe: (view) => ({
  id: 'line-siege.board.summary',
  values: { monstersCount: view.monsters.length, heartsCount: view.hearts },
}),
```

The Shell turns every game `Message` into text in one place, `gameMessageText(t, message)` (`packages/shell/src/i18n/game-message-text.ts`), so VoiceOver reads "3 monsters in the lanes, 2 hearts left" or "۳ هیولا در مسیرها، ۲ قلب باقی مانده" with the player's digits. Nothing else in the Shell casts or builds a game key, and the game's contract test proves the id exists in all four catalogs.

## 6. Test and check

```ts
// test/integration/i18n/line-siege-messages.test.ts
// A game's messages through the real catalogs, the way the Shell shows them. It imports react-intl
// and a game's catalogs, so it lives in the root test/ folder (app code may do neither).
import { createIntl } from 'react-intl';

import ckb from '@e07/line-siege/i18n/ckb.json';
import de from '@e07/line-siege/i18n/de.json';
import en from '@e07/line-siege/i18n/en.json';
import fa from '@e07/line-siege/i18n/fa.json';
import { createT } from '@e07/shell/i18n/create-t.ts';
import { localeTagFor } from '@e07/shell/i18n/digits.ts';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { messagesFor } from '@e07/shell/i18n/messages.ts';

import type { TFunction } from '@e07/shell/i18n/create-t.ts';
import type { Language } from '@e07/shell/i18n/languages.ts';

const LINE_SIEGE = { en, de, fa, ckb };

function failOnError(error: Error): never {
  throw error;
}

function tFor(language: Language): TFunction {
  const intl = createIntl({
    locale: localeTagFor(language, 'automatic'),
    messages: messagesFor(language, LINE_SIEGE),
    defaultLocale: 'en',
    onError: failOnError,
  });
  return createT({ intl, onError: failOnError });
}

describe('Line Siege board summary', () => {
  it.each([
    {
      language: 'en',
      monstersCount: 1,
      heartsCount: 1,
      text: '1 monster in the lanes, 1 heart left',
    },
    {
      language: 'en',
      monstersCount: 3,
      heartsCount: 2,
      text: '3 monsters in the lanes, 2 hearts left',
    },
    {
      language: 'de',
      monstersCount: 3,
      heartsCount: 1,
      text: '3 Monster auf den Bahnen, 1 Herz übrig',
    },
    {
      language: 'fa',
      monstersCount: 3,
      heartsCount: 2,
      text: '۳ هیولا در مسیرها، ۲ قلب باقی مانده',
    },
    { language: 'ckb', monstersCount: 0, heartsCount: 3, text: '۰ دێو لە ڕێڕەوەکاندا، ۳ دڵ ماوە' },
  ] as const)('reads the lanes and the wall in $language', ({ language, text, ...values }) => {
    const summary = { id: 'line-siege.board.summary', values };
    expect(gameMessageText(tFor(language), summary)).toBe(text);
  });
});
```

Why the root `test/` folder: only `packages/shell/src/i18n/` may import `react-intl`, and game code may import nothing from the Shell but its game-facing modules; root integration tests may import both (the same reason the per-game palette tests live there). The rows are objects because a test callback takes at most three parameters (`max-params`).

```sh
node ${CLAUDE_SKILL_DIR}/scripts/check-catalogs.mjs .
node ${CLAUDE_SKILL_DIR}/scripts/check-i18n-code.mjs .
npx jest test/integration/i18n
```

All print `RESULT: PASS` / pass. The fa and ckb texts go on the next native-speaker review list, and the owner is asked to add the text to the copy deck at the next design pass.
