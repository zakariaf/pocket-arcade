# Pocket Arcade

A family of small, offline, single-player 2D games for iPhone (Android later), all built on one reusable React Native framework, "the Shell". Every game ships as its own app. Claude Code writes 100% of the code, tests and release scripts; a human only reviews and play-tests.

This is episode E07 of a "50 Apps Challenge".

## Status

The repository holds the planning stage. The idea research, the product spec and the engineering handbook are done. There is no app code yet; building the Shell and the pilot game (Line Siege) is the next step.

## What's here

| Path | What it is |
|---|---|
| [`spec.txt`](spec.txt) | Product spec for the Shell and its games: every screen and feature, the languages (English, German, Persian, Kurdish Sorani, with right-to-left), ads, the one-time Premium purchase, and the game catalogue |
| [`docs/`](docs/00-README.md) | The engineering handbook. It covers the stack, architecture, naming, code limits, TDD, the game engine approach, i18n/RTL, AdMob, in-app purchase, privacy, and iOS build and release. Start at [`docs/00-README.md`](docs/00-README.md) |
| [`idea-hunt-prompt.md`](idea-hunt-prompt.md) | The prompt that ran the idea research (step 1 of the challenge) |
| [`idea-hunt/`](idea-hunt/) | Research notes, the scored shortlist, and five throwaway playable toys (`idea-hunt/toys/*.html`; open them in a browser) with their acceptance-check script |

## Principles

- **Offline-first.** No accounts and no server of our own. Only ads and store purchases use the internet.
- **One Shell, many apps.** Each game plugs into the shared framework through one `GameModule` contract.
- **No game engine.** Boards are drawn with Skia, animated with Reanimated and driven by pure TypeScript rules, so every game can be tested headlessly.
- **Machine-enforced quality.** Strict TypeScript and ESLint, size limits, TDD, pixel and data goldens, test bots, and end-to-end tests on the iOS simulator.
