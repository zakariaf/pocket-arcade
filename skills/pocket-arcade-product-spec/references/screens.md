# Screens S1-S15

What every Shell screen shows and the rules it follows. This is the product view; the Toybox look of each screen (layout, components, spacing) is built with the `toybox-screens` skill and checked against its design screenshot with the `toybox-visual-parity` skill.

## Contents

- 5 · Screen map (and navigation rules)
- 6 · Screens in detail: S1 Splash, S2 First-run language choice, S3 Ad consent, S4 Home, S5 Game screen, S6 Pause menu, S7 Result screen, S8 Levels, S9 Daily challenge, S10 Statistics, S11 Settings (S11a Language, S11b About and credits, S11c Privacy policy, S11d Licences), S12 Premium, S13 How to play / Tutorial, S14 Dialogs, S15 Debug menu

## 5 · Screen map

```text
S1 Splash
S2 First-run language choice          (first launch only)
--> S13 Tutorial level                (first launch only)
S3 Ad consent                         (only where legally required; before the first ad)
S4 Home
   |-- S5  Game screen
   |     |-- S6 Pause menu
   |     |-- S7 Result screen (win / lose)
   |-- S8  Levels
   |-- S9  Daily challenge
   |-- S10 Statistics
   |-- S11 Settings
   |     |-- S11a Language
   |     |-- S11b About and credits
   |     |-- S11c Privacy policy (offline text)
   |     |-- S11d Licences (open-source and CC0 credits)
   |-- S12 Premium (the purchase page)
   |-- S13 How to play (and tutorial replay)
S14 Dialogs (confirmations, store states, errors)
S15 Debug menu (test builds only)
```

Navigation rules:

- Home is the root. Every other screen has a Back control. In right-to-left languages the Back arrow points right.
- The system back gesture or button always does the same as Back.
- On the Game screen, Back opens the Pause menu instead of leaving, so a stray swipe never loses a run.
- Maximum depth from Home: 2 screens (for example Settings > Language).
- Transitions slide in the reading direction and mirror in RTL.

## 6 · Screens in detail

### S1 · Splash

- Purpose: covers the load time.
- Shows: the game's logo (drawn in code) on the game's background colour.
- Rules:
  - Under 1 second where possible; never waits for the network.
  - Loads the save, settings and language.
  - Then goes to S2 on first launch, otherwise straight to Home.
  - No ad on launch, ever.

### S2 · First-run language choice

First launch only.

- Purpose: make sure a Persian or Sorani speaker whose phone is set to English (very common) can switch immediately.
- Shows:
  - The four languages, each written in its own script: English | Deutsch | فارسی | کوردیی ناوەندی
  - The phone's language is pre-selected when it is one of the four; otherwise English.
  - One big "Continue" button, in the selected language.
- Rules:
  - One tap and done. Can be changed any time in Settings.
  - After Continue, the first launch goes to the tutorial level (S13), not to Home.

### S3 · Ad consent

Only where required.

- Purpose: the legal consent step for ads (spec 4.2).
- Shows: Google's consent message. Its content comes from Google, but the Shell decides when it appears.
- Rules:
  - Never shown before the player has finished the tutorial level: the first minute of the game is play, not paperwork.
  - Shown before the first ad is ever requested.
  - Only in regions where it is required. Everyone else never sees it.
  - Offline or Premium: skipped. It is shown later only if an ad is ever about to load.
  - Settings has a permanent "Ad privacy choices" row that reopens it.

### S4 · Home

- Purpose: one-tap start, and the door to everything else.
- Shows, top to bottom (mirrored in RTL):
  - Top bar: game logo/title at the start; Settings (gear) icon at the end.
  - Big PLAY button: "Continue - Level 12" when a level is in progress; "Play - Level 13" otherwise (the next unfinished level).
  - Daily challenge card: today's date (in the chosen language and digits), "Play today's challenge" or "Done - come back tomorrow", and the current daily streak.
  - Row of buttons: Levels | Statistics | How to play.
  - Premium button with a small crown. Hidden once Premium is owned; replaced by a small "Premium" badge on the logo.
  - Banner ad at the very bottom (only if not Premium AND online AND consent handled). When no banner loads, the space collapses; no empty box.
- Rules:
  - Background music, if the game has any, starts here and respects the settings.
  - Returning from a finished level shows updated stars and streak with a short animation (reduced if "Reduce motion" is on).
- Games with an Endless mode (spec 8.2) show a third mode card on Home: "Endless - Best 4,210".

### S5 · Game screen

- Purpose: the game itself. The Shell provides the frame; the game module provides the board.
- Layout (portrait-first; landscape and tablets get a centred board with side panels):
  - Top bar (the Shell's), mirrored in RTL: Pause button (at the start); mode and level label ("Level 12", "Daily - 26 Sep", "Endless"); goal/progress (for example "Moves 5 / Par 7" or "Monsters 3/10"; the game decides what, the Shell draws it); score; Undo button if the game supports undo; Hint button if the game supports hints (free for Premium; otherwise a rewarded ad or a small daily free allowance, spec 8.10). (The spec's own pointer here says 8.10, but the hint budget, 1 free hint per day, is defined in 8.5; cite 8.5 for hints and 8.10 for continues.)
  - Board area (the game's): the game draws its board and handles its input here.
  - Bottom area (the game's, optional): for example Line Siege's tray of three blocks.
  - No banner ad on this screen. Ever.
- Rules:
  - Every move is saved at once (spec 8.6). Killing the app mid-level and reopening lands back here in the exact same state.
  - The app going to the background pauses the game automatically; coming back shows the Pause menu, not a running game.
  - Touch targets are at least 44x44 points.
  - Screen shake and particles respect "Reduce motion".
  - Sounds respect the sound settings; vibration respects "Vibration".
- Lead decision (2026-09-30, L6): the Game screen has no board design reference, because every game brings its own board. Its visual parity compares only the Shell's parts (top bar and frame) and masks the board area, which comes from the board layout the game reports.

### S6 · Pause menu

An overlay on the game.

- Shows: Resume (big) | Restart level | How to play | Sound on/off | Music on/off | Vibration on/off | Home.
- Rules:
  - "Restart level" asks for confirmation only if progress would be lost beyond a few moves.
  - "Home" keeps the level saved, so Continue on Home resumes it.
  - No ads here.
- Lead decisions (2026-09-30):
  - L1: a game without music (Line Siege has none) shows no Music key; the other keys share the row. Its visual parity uses the design's no-music variant of this menu.
  - L6: parity compares the menu and the Shell's parts over the game and masks the board (no board design reference).

### S7 · Result screen

- Win shows:
  - "Level complete!" with 1-3 stars filling in one by one.
  - Score, and "New best!" when it is one.
  - The goal line, for example "7 moves - par 7".
  - Buttons: NEXT LEVEL (big) | Replay | Levels.
  - In Daily mode: today's result, streak and "Come back tomorrow".
- Lose shows:
  - A short, friendly reason: "The monsters broke through", "No moves left", "The wolf got a sheep".
  - Buttons: TRY AGAIN (big) | Levels.
  - Optional "Continue" (once per level): a rewarded ad, or free for Premium. Only for games that allow continuing (spec 8.10).
- Rules:
  - Stars and statistics are saved before this screen appears.
  - A full-screen ad, if one is due (spec 8.8), appears after the player taps Next / Replay / Try again. Never before they have seen their result, and never on top of it.
  - At most once per day, one friendly Premium line may appear here ("Enjoying it? Remove ads for EUR 1.90"), see S12.
- Lead decisions (2026-09-30):
  - L3: a level rated by score instead of moves (Line Siege's levels) shows a score line in place of the goal line: "Score {score} – best {bestScore}", where best is the level's best score after this run. A level rated by moves keeps "7 moves – par 7". Its visual parity uses the design's score-line variant of the win screen.
  - L6: parity compares the result and the Shell's parts over the game and masks the board (no board design reference).

### S8 · Levels

- Purpose: see progress and pick any unlocked level.
- Shows:
  - Level packs as sections or tabs, for example "Pack 1 - Beginnings (30 levels)"; pack names come from the game.
  - A grid of level tiles. Each tile shows the level number (in the chosen digits), 0-3 stars, and a lock if locked.
  - Pack progress: "54 / 90 stars".
  - Banner ad at the bottom (same rules as Home).
- Rules:
  - Levels unlock one after another. Packs unlock by stars collected (for example pack 2 needs 45 stars), so no player is stuck forever on one hard level.
  - Tapping a locked tile says how to unlock it.
  - Premium does not unlock levels (decision D2; Premium is about ads).

### S9 · Daily challenge

- Purpose: one special level per day. It is the same level for every player in the world, with no server needed.
- How: the level is generated from today's date on the phone (spec 8.3), so every phone makes the same level on the same day.
- Shows:
  - Today's challenge: Play, or the player's result.
  - The current streak and best streak.
  - The last 7 days as a strip of marks (done / missed), mirrored in RTL.
- Rules:
  - The first completion of the day counts for the streak and statistics. Replays are allowed for fun, but do not change the day's result.
  - The day changes at local midnight.
  - If the phone's clock goes backwards, days that were already done stay done, and nothing crashes or double-counts.
  - Streaks follow the plain rule "played yesterday or today". There is no streak insurance and no paid streak repair.

### S10 · Statistics

- Purpose: show players their own history. Stored only on the phone.
- Shows, in cards:
  - Overview: games played, wins, win rate, total play time.
  - Levels: levels completed, stars earned / total, 3-star levels.
  - Best: best score (per mode), best level result, longest win streak.
  - Daily: challenges completed, current streak, best streak.
  - Last 7 days: a small bar chart of games played per day. Time runs right-to-left in RTL.
  - Game-specific card: 2-4 extra numbers the game defines, for example Line Siege: "Monsters defeated", "Beams fired", "Biggest combo".
  - "Reset statistics" button (with confirmation) at the bottom.
  - Banner ad at the bottom (same rules as Home).
- Rules:
  - Every number uses the chosen digits (spec 7.3).
  - Durations are shown as "2 h 14 min" and translated in full.
  - Empty state for a new player: a friendly "Play a level to see your stats here", not a wall of zeros.

### S11 · Settings

Rows, grouped:

- LANGUAGE
  - Language: System / English / Deutsch / فارسی / کوردیی ناوەندی (opens S11a).
  - Numbers: Automatic / Latin (0-9) / Local (۰-۹).
- SOUND AND FEEL
  - Sound effects: on/off + volume.
  - Music: on/off + volume. Hidden if the game has no music.
  - Vibration: on/off. Hidden on devices without vibration.
- DISPLAY
  - Theme: System / Light / Dark.
  - Colour-blind friendly colours: on/off. Switches to a palette where nothing is told apart by colour alone; shapes and symbols carry the meaning.
  - Reduce motion: on/off. Less screen shake, particles and bouncing. Defaults to the phone's own reduce-motion setting.
  - Hints during play: on/off (tutorial tips and nudges).
- PREMIUM
  - Status row: "Premium - active", or "Remove ads - EUR 1.90" (price from the store), which opens S12.
  - Restore purchase.
- PRIVACY
  - Ad privacy choices: reopens the consent step (S3). Shown only where consent applies.
  - Privacy policy: the offline text (S11c).
- DATA
  - Reset statistics (confirm).
  - Reset all progress (confirm by typing or holding the button for 2 seconds). Deletes levels, stars, daily results and statistics. Keeps Premium, language and settings.
- ABOUT
  - About and credits (S11b): game name, version, "Made with Claude Code", support email.
  - Licences (S11d): open-source components, fonts, and CC0 sound sources with their licence notes.
  - Rate this game: opens the store page. The store app handles this; the game itself makes no request.
  - Contact support: opens the phone's email app with the address and version filled in.

Rules:

- Every change applies immediately; there is no Save button.
- Lead decision (2026-09-30, L1): "Hidden if the game has no music" holds for the Music on/off row and the Music volume row together; the rows below close up. Line Siege has no music, so its Settings shows neither row, and its visual parity uses the design's no-music variant of this screen.
- Changing the language switches the text at once. If the direction flips (for example English to Persian), the Shell shows "Restart to apply" and restarts itself with one tap (resolved in the platform step: React Native needs one restart to change direction). The save is untouched either way.

### S11a · Language

The full language list, each name in its own language and script (System / English / Deutsch / فارسی / کوردیی ناوەندی), so someone stuck in the wrong language can find their own. A choice that flips the direction shows "Restart to apply" (see S11).

### S11b · About and credits

Game name, version, "Made with Claude Code", and the support email.

### S11c · Privacy policy

The privacy text, shown offline inside the app. The same text is published on the developer's privacy-policy web page that both stores require (spec 4.2).

### S11d · Licences

Open-source components, fonts, and CC0 sound sources with their licence notes (spec 7.6, N9).

### S12 · Premium

The purchase page. Purpose: sell the one purchase honestly.

- Shows:
  - Title: "Premium".
  - What the player gets, as three short lines: no ads, ever; hints and continues without watching ads; support the developer of this game.
  - Price, exactly as the store reports it, in the player's currency, for example "EUR 1,90", "€1.90" or "۱٫۹۰ یورو". Never typed into the code.
  - One big BUY button.
  - Restore purchase (link).
  - Small print: "One-time purchase. No subscription. Works offline after purchase. Applies to this game only."
- States (every one must be designed and tested):

  | State | What the player sees |
  |---|---|
  | Loading price | Spinner on the button, the rest readable |
  | Store unavailable / offline | "Connect to the internet to buy or restore." BUY disabled |
  | Purchase in progress | Buttons locked, spinner |
  | Pending | For example a parent must approve or a slow payment: "Waiting for approval - you can keep playing." Premium turns on automatically when it completes |
  | Success | A thank-you animation. Ads vanish everywhere at once, and the page shows "Premium - active" |
  | Cancelled by player | Quietly back to the normal page; no error |
  | Error | "The purchase couldn't be completed. You were not charged." plus Try again |
  | Already owned | "Premium - active" plus Restore |

- Rules:
  - Each game has its own Premium, because each game is a separate app. Buying Premium in one game does not unlock another.
  - Premium is never pushed with pop-ups. The only reminders are the Home button, the Settings row, and one friendly line on the result screen at most once per day ("Enjoying it? Remove ads for EUR 1.90").

### S13 · How to play / Tutorial

- First launch: the game's scripted tutorial level. The game guides the first moves with a pointing hand and one short sentence at a time. No text walls, and no Skip until the second step.
- How to play (from Home or Pause):
  - 3-5 short illustrated steps drawn in code (from the game module), swipeable, mirrored in RTL.
  - "Play the tutorial again" button.
- Lead decision (2026-09-30, L4): the steps describe the game as tuned. Line Siege's fourth step says "The monsters march closer every few blocks." (tutorial: "Careful: the monsters march closer every few blocks."), in all four languages; see `line-siege-rules.md`, "What the player sees and hears".

### S14 · Dialogs

- Confirm reset progress / statistics / restart level.
- Premium states (see S12).
- "A new version of the saved data was found" (a save from a newer app version on an older app): keep it, do not touch it, and ask the player to update.
- Damaged save: "Your progress couldn't be loaded. A backup copy was restored." (spec 8.6). Never a crash.
- All dialogs use start/end button order, which mirrors in RTL.

### S15 · Debug menu

Test builds only; never in store builds (it is compiled out of store builds). For the owner and for Claude Code's automated tests:

- Jump to any level; unlock all; give stars.
- Set the date (to test daily challenges and streaks).
- Show the level seed and the game state as text.
- Force ads to always show test ads, or never show.
- Toggle Premium on/off without a purchase.
- Force the language, direction and digits.
- Simulate offline.
- Export and import the save as text (testing only).
- Also shows the local error log and the network-attempt counter ("network attempts: 0").
