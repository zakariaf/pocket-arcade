// packages/shell/src/app/parity/parity-start.ts
// Test builds only (reached through test-only.ts). The navigator state a parity launch opens on:
// the plan's start route on top of the screens a player would have come through, so Back behaves
// as in the real app.
import type { ParityPlan, ParityStart } from './parity-plans.ts';
import type { InitialState } from '@react-navigation/native';

/** Splash (S1) and the consent moment (S3) are held by the startup before the navigator shows. */
const HELD_STARTS: readonly ParityStart[] = ['Splash', 'Consent'];

/** The Settings sub-pages open from Settings (Back returns there). */
const SETTINGS_PAGES: readonly ParityStart[] = [
  'SettingsLanguage',
  'About',
  'PrivacyPolicy',
  'Licences',
];

/** True when the startup must hold the splash or the consent moment instead of the navigator. */
export function isHeldParityStart(plan: Pick<ParityPlan, 'start'>): boolean {
  return HELD_STARTS.includes(plan.start);
}

/**
 * Home is the root of the Main group; every other start sits on top of it. A first-run plan
 * leaves the choice to the FirstRun group (undefined), as do the held startup states.
 */
export function parityInitialState(
  plan: Pick<ParityPlan, 'start' | 'progress'>,
): InitialState | undefined {
  if (isHeldParityStart(plan) || plan.progress === 'first-run') return undefined;
  if (plan.start === 'Home') return { routes: [{ name: 'Home' }] };
  if (plan.start === 'Game') {
    return { index: 1, routes: [{ name: 'Home' }, { name: 'Game', params: { start: 'resume' } }] };
  }
  if (SETTINGS_PAGES.includes(plan.start)) {
    return { index: 2, routes: [{ name: 'Home' }, { name: 'Settings' }, { name: plan.start }] };
  }
  return { index: 1, routes: [{ name: 'Home' }, { name: plan.start }] };
}
