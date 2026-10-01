# S12 Premium

S12 sells the one purchase honestly and draws every purchase state.

## Contents

- What the product requires
- Layout, top to bottom
- States and variants
- Data the model supplies
- Templates
- testIDs
- Copy keys
- Reference images
- Pitfalls

## What the product requires

- Title "Premium"; what you get as three short lines (no ads ever; hints and continues without ads; support the developer).
- The price exactly as the store reports it, in the player's currency; never typed into the code. Premium is the EUR 1.99 App Store price point (the owner's decision of 2026-09-30), and it is not shared through Apple's Family Sharing: each Apple account buys it for itself.
- One big BUY button; Restore purchase (link); small print: "One-time purchase. No subscription. Works offline after purchase. Applies to this game only."
- States, each designed and tested: Loading price (spinner on the button, the rest readable); Store unavailable / offline ("Connect to the internet to buy or restore.", BUY disabled); Purchase in progress (buttons locked, spinner); Pending ("Waiting for approval – you can keep playing."; Premium turns on by itself); Success (a thank-you animation; ads vanish everywhere at once; "Premium – active"); Cancelled (quietly back to the normal page, no error); Error ("The purchase couldn't be completed. You were not charged." + Try again); Already owned ("Premium – active" + Restore).
- Premium is never pushed with pop-ups. No banner.

## Layout, top to bottom

Top bar "Premium" with Back (in every state). The body runs under the home indicator (`UNDER_HOME_INDICATOR_EDGES`, `ScreenBody isUnderHomeIndicator`), so a key at the bottom (Restore on the owned page) keeps its hard shadow. **Normal page** (`s12-premium.png`): the page column's gap is the body's block gap, 14 (`LAYOUT.blockGap`; a gap of 12 put the benefits 2 pt high and Buy 3.4 pt low):

1. Header row (centred, gap 20, padding 6 block): the Premium art (108, radius 22, gold, 5 pt ring, tilt -6 deg, 64 pt crown) → column (gap 6, content-sized with `flexShrink: 1`, never `flex: 1`, as the design's span: a one-line Persian subtitle keeps the column narrower than the room beside the art): title (`display` 38) + subtitle (muted).
2. Benefits list (accent icon tiles): `close` "No ads, ever." · `hint` "Hints and continues without watching ads." · `star-filled` "Support the developer of this game."
3. grow.
4. Hero key with a `crown` cap: "Buy – €1.99".
5. Quiet nudge with `restore`, centred: "Restore purchase".
6. Small print (13, muted).

**States** (the design draws them as 390-wide cards; under the heading):

| State (store view) | Content |
|---|---|
| Loading price (`loading-price`) | subtitle · grow · busy hero "Loading price…" · quiet Restore · small print |
| Store unavailable (`store-unavailable`) | note panel `wifi-off` · grow · disabled hero with `crown` cap "Remove ads" · disabled quiet Restore |
| Purchase in progress (`purchase-in-progress`) | subtitle · grow · busy hero "Purchase in progress…" · disabled quiet Restore · small print |
| Pending (`pending`) | note panel `clock` with Bold text · muted detail · grow · quiet Restore |
| Success (`success`) | confetti · "Thank you!" (`display`) · lead · "Premium – active" sticker (crown, tilt -3 deg, slapped in). The confetti follows two inputs: `isReducedMotion` (`useReduceMotion()`, also on during a parity capture) holds it at its first still frame, and `isConfettiHidden` (the model's `useReduceMotionSetting()`, the player's saved Reduce motion setting, never the frozen-motion answer) removes it. So the frozen success card still draws its confetti, as the design does. |
| Error (`error`) | error note panel (danger edge, dangerFill, `alert`) · grow · hero with `restore` cap "Try again" · quiet Restore |
| Already owned (`already-owned`) | "Premium – active" sticker · lead "Thanks for supporting {gameName}!" · grow · secondary block Restore purchase |
| Restore results (`restoring`, `restore-empty`, `restore-failed`) | the normal page plus one toast: busy "Restoring…", "No earlier purchase was found.", "Couldn't restore right now…"; a successful restore shows "Purchase restored. Premium is active." |

## States and variants

The state comes from the premium store's `premiumView()` (premium-purchase owns it); each non-ready state has a marker View (`premium.state.loading` …) that E2E flows wait for. The restore card of the design shows four toasts at once; the app shows one at a time, except in the parity capture of that card, where the model sets `isRestoreToastStack` and `PremiumToast` stacks all four (restoring, restored, nothing found, failed; 10 pt apart, the Toybox toast stack gap).

## Data the model supplies

`PremiumModel` (`premium-model.ts`): `view` (`PremiumView`), `hasJustRestored`, `isRestoreToastStack` (the parity restore card only), `priceText` (the store's localised string, or null while loading: the price is never typed in the app; Premium is the EUR 1.99 App Store price point), `gameName`, `isReducedMotion`, `isConfettiHidden` (the saved Reduce motion setting, for the success confetti), `onBack`, `onBuy`, `onRestore`, `onTryAgain`. `premium-hero.ts` picks the one hero key of each state.

The model hook ships as a template, wired to premium-purchase's store and service:

- `premium-model-of.ts` (pure, tested): `view` from `premiumView(state)`, `priceText` from `priceOf(state.flow)`, `hasJustRestored` from `state.didJustRestore`; `onBuy` and `onTryAgain` run `buyPremium(service)`, `onRestore` runs `restorePremium(service)`, each ending in `.catch(service.onError)` (handlers stay synchronous; "Try again" after an error is a new purchase request).
- `use-premium-model.ts`: reads the premium store through `useShallow`, the service and game name from `usePremiumScreenDeps()`, `navigation.goBack()` for Back and `useReduceMotion()`. It announces each restore toast to VoiceOver once (`useAnnounce`, through `useEffectEvent`), and after `NOTICE_MS` (3 s, Chosen) dispatches `thanks-shown` (the thank-you page becomes the owner page) and `restore-notice-shown` (the "Purchase restored" toast goes), so neither shows twice. In a parity capture (test builds) it opens the frame's card the way a player would: on `premium-purchasing`, `premium-pending-approval`, `premium-success` and `premium-error` it presses Buy once, as soon as the price has loaded (view `ready`; `useEffectEvent` around `onBuy`, an effect that depends only on that condition), and the parity store port answers by keeping the sheet up, pending, purchased or failed; on `premium-restore-toasts` it sets `isRestoreToastStack`; and during any capture it holds the thank-you page and the "Purchase restored" toast instead of clearing them after `NOTICE_MS`. `premium-loading-price`, `premium-store-unavailable` and `premium-already-owned` need no press: the parity store port alone draws them. The test runs each card through `createParityPurchase` and `startPremium`.
- `app/premium-screen-deps-context.tsx`: `PremiumScreenDepsProvider` and `usePremiumScreenDeps()`. ShellApp wraps the navigator in it with `{ service, gameName }`: `service` is the same `PremiumServiceDeps` object the composition root built for `startPremium()` (port, productId, dispatch, persistPremium, formatPrice, onError), and `gameName` the game module's name message (`{ id: '<game-id>.name' }`, turned into text with `gameMessageText`). Settings' "Restore purchase" row runs `restorePremium(usePremiumScreenDeps().service)` too. A missing provider throws.
- `premium-toasts.ts`: the one toast of a model (`premiumToastFor(view, hasJustRestored)`), shared by `PremiumToast` and the hook's announcement; `premiumToastsFor(model)` is what `PremiumToast` draws (the stack on the restore card, otherwise at most that one).

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/premium/`.

- `packages/shell/src/screens/premium/premium-model.ts`
- `packages/shell/src/screens/premium/premium-hero.ts`
- `packages/shell/src/screens/premium/premium-offer.tsx`
- `packages/shell/src/screens/premium/premium-page.tsx`
- `packages/shell/src/screens/premium/premium-restore.tsx`
- `packages/shell/src/screens/premium/premium-state-body.tsx`
- `packages/shell/src/screens/premium/premium-success.tsx`
- `packages/shell/src/screens/premium/premium-toast.tsx`
- `packages/shell/src/screens/premium/premium-screen.tsx`
- `packages/shell/src/screens/premium/premium-toasts.ts`
- `packages/shell/src/screens/premium/premium-model-of.ts`
- `packages/shell/src/app/premium-screen-deps-context.tsx`
- `packages/shell/src/screens/premium/use-premium-model.ts`
- `packages/shell/src/screens/premium/premium-page.test.tsx`
- `packages/shell/src/screens/premium/premium-model-of.test.ts`
- `packages/shell/src/screens/premium/use-premium-model.test.tsx`

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S12` prints every element with its English text.

Map note: The eight state cards are 390-wide fragments, not phone screens: compare text, fill and crop, never position. Cancelled has no screen (normal page). The restore card shows four separate outcomes at once as a toast stack.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `premium.screen` | ScreenFrame | none |  | normal |  |
| `premium.top-bar` | TopBar | none |  | normal | .back-button .title |
| `premium.header` | View | none |  | normal |  |
| `premium.art` | PremiumArt (108, gold, crown, -6 deg) | none |  | normal |  |
| `premium.title` | AppText | header | `common.premium` | normal |  |
| `premium.subtitle` | AppText | text | `premium.subtitle` | normal, loading, purchasing |  |
| `premium.benefits-list` | ListGroup | none |  | normal |  |
| `premium.benefit.no-ads` | ListRow | none |  | normal | .icon .label |
| `premium.benefit.free-perks` | ListRow | none |  | normal | .icon .label |
| `premium.benefit.support` | ListRow | none |  | normal | .icon .label |
| `premium.buy-button` | Button (primary hero, crown cap) | button | `premium.buy-button`; `premium.loading`; `settings.premium.remove-ads-no-price`; `premium.purchasing` | normal, loading, unavailable, purchasing |  |
| `premium.restore-button` | Button (quiet, restore icon, centred) | button | `common.restore-purchase` | normal, loading, unavailable, purchasing, pending, error, owned |  |
| `premium.small-print` | AppText | text | `premium.small-print` | normal, loading, purchasing |  |
| `premium.state.loading` | View | none |  | loading |  |
| `premium.state.unavailable` | View | none |  | unavailable |  |
| `premium.state.purchasing` | View | none |  | purchasing |  |
| `premium.state.pending` | View | none |  | pending |  |
| `premium.state.success` | View | none |  | success |  |
| `premium.state.error` | View | none |  | error |  |
| `premium.state.owned` | View | none |  | owned |  |
| `premium.try-again-button` | Button (primary hero, restore cap) | button | `premium.try-again` | error |  |
| `premium.unavailable-note` | NotePanel | none |  | unavailable | .icon .label |
| `premium.pending-note` | NotePanel | none |  | pending | .icon .label |
| `premium.pending-detail` | AppText | text | `premium.pending-detail` | pending |  |
| `premium.confetti` | Confetti | none |  | success |  |
| `premium.success-title` | AppText | header | `premium.success.title` | success |  |
| `premium.success-body` | AppText | text | `premium.success.body` | success |  |
| `premium.active-sticker` | Sticker (gold, crown, -3 deg) | text | `premium.active` | success, owned |  |
| `premium.error-note` | NotePanel (error (danger edge, dangerFill)) | none |  | error | .icon .label |
| `premium.owned-body` | AppText | text | `premium.owned.body` | owned |  |
| `premium.restoring-toast` | Toast (busy blocks) | alert | `premium.restoring` | restore |  |
| `premium.restore-success-toast` | Toast (check) | alert | `premium.restore-success` | restore |  |
| `premium.restore-empty-toast` | Toast (info) | alert | `premium.restore-empty` | restore |  |
| `premium.restore-failed-toast` | Toast (alert) | alert | `premium.restore-failed` | restore |  |

## Copy keys

| Key | English |
|---|---|
| `common.back` | Back |
| `common.premium` | Premium |
| `premium.subtitle` | A one-time upgrade for {gameName}. |
| `premium.benefit.no-ads` | No ads, ever. |
| `premium.benefit.free-perks` | Hints and continues without watching ads. |
| `premium.benefit.support` | Support the developer of this game. |
| `premium.buy-button` | Buy – {priceText} |
| `common.restore-purchase` | Restore purchase |
| `premium.small-print` | One-time purchase. No subscription. Works offline after purchase. Applies to this game only. |
| `premium.loading` | Loading price… |
| `settings.premium.remove-ads-no-price` | Remove ads |
| `premium.purchasing` | Purchase in progress… |
| `premium.try-again` | Try again |
| `premium.store-unavailable` | Connect to the internet to buy or restore. |
| `premium.pending` | Waiting for approval – you can keep playing. |
| `premium.pending-detail` | Premium turns on by itself as soon as the purchase is approved. |
| `premium.success.title` | Thank you! |
| `premium.success.body` | Premium is active. Ads are gone for good. |
| `premium.active` | Premium – active |
| `premium.error` | The purchase couldn’t be completed. You were not charged. |
| `premium.owned.body` | Thanks for supporting {gameName}! |
| `premium.restoring` | Restoring… |
| `premium.restore-success` | Purchase restored. Premium is active. |
| `premium.restore-empty` | No earlier purchase was found. |
| `premium.restore-failed` | Couldn’t restore right now. Please try again later. |

## Reference images

- `assets/reference/s12-premium.png` (normal; phone)
- `assets/reference/s12-loading-price.png` (loading; state-card)
- `assets/reference/s12-store-unavailable-offline.png` (unavailable; state-card)
- `assets/reference/s12-purchase-in-progress.png` (purchasing; state-card)
- `assets/reference/s12-pending-approval.png` (pending; state-card)
- `assets/reference/s12-success.png` (success; state-card)
- `assets/reference/s12-error.png` (error; state-card)
- `assets/reference/s12-already-owned.png` (owned; state-card)
- `assets/reference/s12-restore-results-toasts.png` (restore; state-card)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- A hard-coded or formatted price: show the store's string as it is.
- An error message on cancel: cancelling returns quietly to the normal page.
- A banner, a countdown or a pop-up on S12.
- Handing the confetti the frozen-motion answer as its hide switch: a parity capture then loses the pieces the design draws. Pass the saved setting (`useReduceMotionSetting()`) as `isHiddenBySetting`.
