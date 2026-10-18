// packages/tooling/src/audit/data-safety.test.ts
// Spec 4.2 point 1: "Apple's "App Privacy" details and Google Play's "Data safety" form must
// declare what the ads component collects (usually device identifiers, approximate location from
// the network, and ad interaction data). ... So the app cannot claim "collects no data". It can
// claim no accounts, no personal data collected by us, and fully playable offline."
import { dataSafetyAnswers } from './data-safety.ts';

describe('the Google Play Data safety answers (spec 4.2 point 1)', () => {
  it('declares what the ads SDK collects and shares, and that our own code collects nothing', () => {
    expect(dataSafetyAnswers({ gameId: 'line-siege', isAdsEnabled: true })).toStrictEqual([
      'Data safety (Google Play), line-siege: Play Console, App content, Data safety (owner step GP4)',
      'Does your app collect or share any of the required user data types? Yes: the ads SDK (Google Mobile Ads) does; our own code collects nothing',
      'Is all of the user data collected by your app encrypted in transit? Yes',
      'Do you provide a way for users to request that their data is deleted? No: there is no account to delete, and our own code stores nothing off the phone',
      'Location > Approximate location: collected and shared by the ads SDK, for advertising',
      'Device or other IDs: collected and shared by the ads SDK, for advertising',
      'App activity > App interactions: collected and shared by the ads SDK, for advertising',
      'App info and performance > Diagnostics: collected and shared by the ads SDK, for advertising',
      'Every other data type (personal info, financial info, messages, photos, audio, files, calendar, contacts, health, web browsing): not collected',
      'Advertising ID (App content): Yes, the app uses an advertising ID, for advertising',
    ]);
  });

  it('declares no data at all for a game with ads switched off', () => {
    expect(dataSafetyAnswers({ gameId: 'flock-tilt', isAdsEnabled: false })).toStrictEqual([
      'Data safety (Google Play), flock-tilt: Play Console, App content, Data safety (owner step GP4)',
      'Does your app collect or share any of the required user data types? No: ads are off and our own code collects nothing',
      'Advertising ID (App content): No',
    ]);
  });

  it('refuses to claim "collects no data" while ads are on', () => {
    const answers = dataSafetyAnswers({ gameId: 'line-siege', isAdsEnabled: true });
    expect(answers.some((line) => line.includes('required user data types? No'))).toBe(false);
  });
});
