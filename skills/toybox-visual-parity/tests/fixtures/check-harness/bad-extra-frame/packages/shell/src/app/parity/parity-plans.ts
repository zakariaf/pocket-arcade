// packages/shell/src/app/parity/parity-plans.ts
// Test builds only (reached through test-only.ts). One plan per Toybox design frame: where the
// parity harness starts and which state it sets up so the screen matches the frame's reference.
// Keys and root testIDs must equal the skill's frames manifest (check-harness.mjs compares them).

/** Where the harness starts. Splash and Consent are the held startup states before the navigator. */
export type ParityStart =
  | 'Splash'
  | 'LanguageChoice'
  | 'Consent'
  | 'Home'
  | 'Game'
  | 'Levels'
  | 'Daily'
  | 'Stats'
  | 'Settings'
  | 'SettingsLanguage'
  | 'About'
  | 'PrivacyPolicy'
  | 'Licences'
  | 'Premium'
  | 'HowToPlay'
  | 'Debug';

/** The player data the harness loads: the design's demo player, a new player, or a first launch. */
export type ParityProgress = 'demo' | 'new-player' | 'first-run';

/**
 * Ad consent in the frame's save: given (every frame but one), or still required, which is what the
 * S3 consent moment needs (with the player online, the tutorial done and no Premium).
 */
export type ParityConsent = 'given' | 'required';

/** What the harness opens or freezes on top of the start screen (null: nothing). */
export type ParityState =
  | 'pause-open'
  | 'result-win'
  | 'result-lose'
  | 'levels-locked-tile-tapped'
  | 'how-to-play-step-2'
  | 'premium-loading-price'
  | 'premium-store-unavailable'
  | 'premium-purchasing'
  | 'premium-pending-approval'
  | 'premium-success'
  | 'premium-error'
  | 'premium-already-owned'
  | 'premium-restore-toasts'
  | 'reset-progress-dialog-held'
  | 'restart-dialog'
  | 'save-restored-dialog';

export type ParityPlan = {
  /** The testID that proves the frame is on screen. */
  readonly root: string;
  readonly start: ParityStart;
  readonly progress: ParityProgress;
  readonly premium: boolean;
  readonly consent: ParityConsent;
  readonly state: ParityState | null;
  /** The design draws the full scroll height: capture at several scroll offsets. */
  readonly tall: boolean;
};

type PlanOptions = {
  readonly progress?: ParityProgress;
  readonly premium?: boolean;
  readonly consent?: ParityConsent;
  readonly state?: ParityState;
  readonly tall?: boolean;
};

function plan(root: string, start: ParityStart, options: PlanOptions = {}): ParityPlan {
  return {
    root,
    start,
    progress: options.progress ?? 'demo',
    premium: options.premium ?? false,
    consent: options.consent ?? 'given',
    state: options.state ?? null,
    tall: options.tall ?? false,
  };
}

export const PARITY_PLANS = {
  's5-game': plan('game.screen', 'Game'),
  's1-splash': plan('splash.screen', 'Splash'),
  's2-language-choice': plan('language-choice.screen', 'LanguageChoice', {
    progress: 'first-run',
  }),
  's3-consent-moment': plan('consent.screen', 'Consent', { consent: 'required' }),
  's4-home': plan('home.screen', 'Home'),
  's4-home-premium': plan('home.screen', 'Home', { premium: true }),
  's6-pause': plan('game.screen', 'Game', { state: 'pause-open' }),
  's7-result-win': plan('result.screen', 'Game', { state: 'result-win' }),
  's7-result-lose': plan('result.screen', 'Game', { state: 'result-lose' }),
  's8-levels': plan('levels.screen', 'Levels', {
    state: 'levels-locked-tile-tapped',
  }),
  's9-daily-challenge': plan('daily.screen', 'Daily'),
  's10-statistics': plan('stats.screen', 'Stats', { tall: true }),
  's10-statistics-empty': plan('stats.screen', 'Stats', {
    progress: 'new-player',
  }),
  's11-settings': plan('settings.screen', 'Settings', { tall: true }),
  's11a-language': plan('settings-language.screen', 'SettingsLanguage'),
  's11b-about-and-credits': plan('about.screen', 'About'),
  's11c-privacy-policy': plan('privacy-policy.screen', 'PrivacyPolicy', {
    tall: true,
  }),
  's11d-licences': plan('licences.screen', 'Licences', { tall: true }),
  's12-premium': plan('premium.screen', 'Premium'),
  's12-loading-price': plan('premium.state.loading', 'Premium', {
    state: 'premium-loading-price',
  }),
  's12-store-unavailable-offline': plan('premium.state.unavailable', 'Premium', {
    state: 'premium-store-unavailable',
  }),
  's12-purchase-in-progress': plan('premium.state.purchasing', 'Premium', {
    state: 'premium-purchasing',
  }),
  's12-pending-approval': plan('premium.state.pending', 'Premium', {
    state: 'premium-pending-approval',
  }),
  's12-success': plan('premium.state.success', 'Premium', {
    state: 'premium-success',
  }),
  's12-error': plan('premium.state.error', 'Premium', {
    state: 'premium-error',
  }),
  's12-already-owned': plan('premium.state.owned', 'Premium', {
    premium: true,
    state: 'premium-already-owned',
  }),
  's12-restore-results-toasts': plan('premium.restoring-toast', 'Premium', {
    state: 'premium-restore-toasts',
  }),
  's13-how-to-play': plan('how-to-play.screen', 'HowToPlay', {
    state: 'how-to-play-step-2',
  }),
  's14-reset-all-progress': plan('reset-progress-dialog.scrim', 'Settings', {
    state: 'reset-progress-dialog-held',
  }),
  's14-restart-to-apply': plan('restart-dialog.scrim', 'SettingsLanguage', {
    state: 'restart-dialog',
  }),
  's14-progress-restored': plan('save-restored-dialog.scrim', 'Home', {
    state: 'save-restored-dialog',
  }),
  's15-debug-menu': plan('debug.screen', 'Debug', { tall: true }),
} as const satisfies Readonly<Record<string, ParityPlan>>;

export type ParityFrameKey = keyof typeof PARITY_PLANS;

/** Narrows any string to a known frame key. */
export function isParityFrameKey(value: string): value is ParityFrameKey {
  return Object.hasOwn(PARITY_PLANS, value);
}
