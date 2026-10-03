// packages/shell/src/game-host/run-end-policy.ts
// L11, never strand a finished run. A lost run keeps its continue open only while the player can
// still take it: Premium ('free'), a rewarded ad that is ready ('watch-ad') or still loading
// ('loading', S7 draws the ad key busy). When the offer is 'hidden' (ads off, offline, no consent,
// no rewarded ad that can come, no Premium), nobody can rescue the run, so the Game screen model
// sends { type: 'finish' } once per eventSeq: the run end is recorded (statistics, streak, endless
// best, ad history) and the recorded Result shows at once, the endless result with its score and
// New best, or the lose result without an offer. The same holds when a shown offer becomes hidden
// (offline, a load error) and when a pending lost run is reopened from Home.
import type { SessionView } from '@e07/shell/game-host/session-view.ts';
import type { PerkOffer } from '@e07/shell/services/ads/perk-offer.ts';

/** True for a lost run that waits for a continue nobody can give (send 'finish' for it). */
export function isLossStranded(view: SessionView, continueOffer: PerkOffer): boolean {
  return (
    view.ref.kind !== 'tutorial' &&
    view.status === 'lost' &&
    view.continueState === 'offered' &&
    view.summary === null &&
    continueOffer === 'hidden'
  );
}
