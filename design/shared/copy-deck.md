# Pocket Arcade Shell: copy deck notes

`copy-deck.json` holds every visible text of the Shell screens S1-S4 and S6-S15 in English, German, Persian and Sorani. The three design mockups embed it. It is a draft: **fa and ckb still need a native speaker's review.**

## What is in the file

| Section | Contents |
|---|---|
| `meta` | Languages, direction, autonyms, `numberLocales` (digit tags), the ICU subset, a glossary, `samples` and `sampleOverrides` (values for every placeholder), `renderNotes`, and `screens` (which keys each screen uses). |
| `games` | `lineSiege`, `flockTilt`, `scrapShove`. Each has a name (always Latin), tagline, goal, progress line, win title, lose reason, 3 stats labels, 4 how-to-play steps, 4 tutorial one-liners and 3 pack names. |
| `licenceEntries` | Example rows for S11d. Component and licence names are not translated. The sound row points to string keys. |
| `strings` | 288 flat keys, sorted, each with `en`, `de`, `fa` and `ckb`. |

## Key naming

- Keys follow docs/03 section 9: `<area>.<element>[.<variant>]`, 2 to 5 lowercase kebab-case segments. The first segment is the screen (`home`, `pause`, `result`, `levels`, `daily`, `stats`, `settings`, `language`, `about`, `privacy`, `licences`, `premium`, `how-to-play`, `tutorial`, `consent`, `language-choice`, `splash`, `game-screen`, `debug`), or `common`, `dialog` or `date`.
- Keys name the place, never the words. The last segment names the role: `.title`, `.body`, `.label`, `.description`, `.a11y-label`, `-button`.
- A text that appears on several screens with the same meaning has one `common.*` key (Levels, How to play, Try again, Restore purchase, the banner's "Ad" label, and so on).
- Where docs/10, docs/05 or docs/12 already named a key, the deck uses that name. Examples: `home.play-button.continue`, `result.win.moves`, `levels.pack.locked`, `stats.duration`, `premium.pending`, `premium.error` and `settings.language.restart.title`. So the Premium states are `premium.pending` and `premium.pending-detail`, not `premium.state.pending.body`.
- No key is a prefix of another key, so the flat file can be turned into nested objects safely.

## Placeholders and numbers

- Numbers are typed: `{level, number}` or `{rate, number, ::percent}`. Counted nouns are plurals: `{movesCount, plural, one {# move} other {# moves}}`. fa and ckb keep both `one` and `other`, with the same singular noun in each. Any `=0` branch exists in all four languages, because in Persian `one` covers 0.
- Free text ends in `Name` or `Text`: `{gameName}`, `{packName}`, `{dateText}`, `{monthName}`, `{weekdayName}`, `{languageName}`, `{versionText}`, `{emailText}` and **`{priceText}`** (the store price, e.g. "€1.99"). The brief said `{price}`. The deck uses `{priceText}` because docs/10 rule 5 and the catalog linter reject a plain `{price}`. `meta.samples.priceText` holds the store string for each language.
- The strings contain no literal digits. The page formats every number with `meta.numberLocales` (`fa-u-nu-arabext` and `ckb-u-nu-arabext` give ۰-۹ with ٬ ٫ ٪).
- Dates use `date.day-month`, `date.weekday-day-month` or `date.day-month-year` with CLDR month and weekday names, Gregorian in all four languages. The 7-day strip uses `date.weekday-strip.1..7` (1 = Monday). These are short names for en/de and single letters for fa/ckb, because the CLDR short names in those languages are full words.
- The deck passes the docs/10 catalog-linter rules L1-L12: key shape, ICU parse, placeholder names and types identical across languages, plural categories, no digits, no bidi controls, no Arabic ي/ك, and ، ؛ ؟ in fa/ckb.

## Tone per language

- **English:** short, friendly, sentence case. British spelling, as in the spec ("colour", "licences"). The separator is a spaced en dash ("Continue – Level 12"). Apostrophes are typographic (’), because an ASCII `'` is an escape character in ICU.
- **German:** informal "du" (D7). Common gaming anglicisms stay: "Level", "Levels", "Premium", "Tages-Challenge". "Anzeige" labels the banner, as German practice expects.
- **Persian:** friendly but neutral, with the polite plural imperative ("انتخاب کنید", "بازی کنید"), which is the usual register in Iranian apps. ZWNJ is used throughout (می‌شود، ستاره‌ها، به‌روز). Ezafe is written as ـهٔ (مرحلهٔ). Punctuation is Persian (، ؟). Month names are Gregorian (سپتامبر).
- **Sorani:** plain, everyday words, with the singular informal imperative ("هەڵبژێرە", "یاری بکە"), which is the normal register in Sorani apps. The text uses the Sorani letters ێ ۆ ە ڕ ڵ, with ە for the vowel e and ه (U+0647) for h. It has no ZWNJ and uses Persian-style punctuation (، ؟). Persian function words (است، را، از، که، این) were checked automatically and do not appear.
- **Debug menu (S15):** English in all four languages on purpose.

## Check these first (native reviewer)

Ordered roughly by how visible they are.

### Persian (fa)

| Key(s) | Current text | Question |
|---|---|---|
| `common.premium`, all Premium strings | پریمیوم | Keep the loanword (as Telegram does), or use "نسخهٔ ویژه"? |
| `result.win.moves`, `game-screen.progress.moves-par` | ۷ حرکت – هدف ۷ | "Par" is written as "هدف". The docs/10 example used "پار", which reads as "last year". Is "هدف" clear? |
| `daily.streak.*`, `stats.best.win-streak` | زنجیرهٔ فعلی، بهترین زنجیره، ۵ روز پیاپی، هنوز زنجیره‌ای ندارید | Is "زنجیره" natural for a streak? |
| Tone, all fa | …کنید / …بزنید | Is the polite plural right for a casual game, or is the singular informal better? |
| `settings.numbers.local` | محلی | Would "فارسی" be clearer for ۰-۹? |
| `games.lineSiege.stats.biggestCombo` | بزرگ‌ترین کمبو | Is the gamer loanword acceptable? |
| Flock Tilt texts | آغل، کج کردن، انگشتتان را بکشید | Pen, tilt and swipe wording. |
| `settings.colour-blind.label` | رنگ‌های مناسب کوررنگی | Natural? |
| `pause.title`, `result.endless.title`, `result.lose.title` | بازی متوقف شد، دور تمام شد، این بار نشد | Natural? |
| `premium.error` | خرید انجام نشد. هیچ مبلغی از شما کسر نشد. | Natural? |
| `date.weekday-strip.*` | د س چ پ ج ش ی | Are single letters clear in the 7-day strip? |

### Sorani (ckb)

| Key(s) | Current text | Question |
|---|---|---|
| `common.premium`, all Premium strings | پریمیەم | Spelling of the loanword. |
| `settings.group.privacy`, `settings.privacy-policy.label`, `consent.intro.*`, `settings.ad-privacy.label`, `privacy.ads.body` | تایبەتێتی، سیاسەتی تایبەتێتی | Is "تایبەتێتی" the usual word for privacy, or is "تایبەتمەندی" (which can mean "feature")? |
| Line Siege texts (goal, loseReason, stats, howToPlay, tutorial) | دێو، دێوەکان دیوارەکەیان بەزاند | Is "دێو" right for a monster, and "بەزاندن" for breaking through? |
| Flock Tilt texts | گەوڕ، لار بکەرەوە، پەنجە ڕابکێشە، دەخلیسکێت | Is "گەوڕ" right for a sheep pen? Check tilt, swipe and slide wording. |
| Scrap Shove texts | ئاسنی کۆن، پاڵی پێوە بنێیت، پێکدادان، بەر یەکتر بکەون | Scrap, shove and crash wording. |
| `settings.hints.label`, `premium.benefit.free-perks` | ئاماژە | Is this the right word for a game hint? |
| `daily.streak.*`, `stats.best.win-streak` | زنجیرە، ۵ ڕۆژ لەسەر یەک، هێشتا زنجیرەت نییە | Streak wording. |
| `premium.small-print` | بێ ئابوونە | Is "ئابوونە" right for a subscription? The alternative is "بەشداریکردن". |
| Tone, all ckb | singular imperative (تۆ) | OK, or should it be the plural (ئێوە)? |
| `tutorial.tap-to-continue`, tap lines | دەست لێ بدە، دەست لە … بدە | Tap wording. "کرتە بکە" is the alternative. |
| `settings.colour-blind.label` | ڕەنگی گونجاو بۆ کوێریی ڕەنگ | Is "کوێریی ڕەنگ" right for colour blindness? |
| Letter h everywhere; `date.weekday.5`; `date.weekday-strip.5` | ه (U+0647); CLDR uses ھ (U+06BE) | The deck uses U+0647, but the lone Friday letter keeps ھ so it is not read as ە. Which should the app use? |
| `date.month-short.12` | کانوونی یەکەم | CLDR writes کانونی یەکەم (docs/10 open issue 4). |
| `games.lineSiege.stats.biggestCombo` | زۆرترین هێڵ لە یەک جووڵەدا | The deck avoids a loanword. Is the phrase too long, and would "کۆمبۆ" be better? |
| `common.mode.endless`, `common.best-score`, `result.win.moves` | بێکۆتا، باشترین، ئامانج (par) | Word choices. |
| `premium.subtitle`, `result.premium-nudge`, `licences.group.software` | بەرزکردنەوەیەکی یەکجاری، پێت خۆشە؟، سەرچاوەکراوە | Natural? |

## Rebuilding

The deck was generated and linted by `build-copy-deck.mjs` in the session's scratchpad. It uses the ICU parser that docs/10's linter uses, and it checks placeholder parity across the four languages. When editing `copy-deck.json` by hand, keep the placeholders identical in all four languages and keep the keys sorted.
