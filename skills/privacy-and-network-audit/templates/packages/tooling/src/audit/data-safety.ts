// packages/tooling/src/audit/data-safety.ts
// The answers for Google Play's Data safety form (spec 4.2 point 1), printed by
// `npm run audit:privacy -- --platform android` for the owner's Play Console step (GP4). The ads
// SDK (Google Mobile Ads) collects and shares device or other IDs, approximate location, app
// interactions and diagnostics for advertising, encrypted in transit. Our own code collects
// nothing: no account, no personal data, the save stays on the phone, so there is no account to
// delete. Google Play Billing takes the payment; the app keeps only its Premium flag on the phone.
export type DataSafetyInput = { readonly gameId: string; readonly isAdsEnabled: boolean };

const ADS_SDK_TYPES = [
  'Location > Approximate location',
  'Device or other IDs',
  'App activity > App interactions',
  'App info and performance > Diagnostics',
] as const;

export function dataSafetyAnswers(input: DataSafetyInput): string[] {
  const header = `Data safety (Google Play), ${input.gameId}: Play Console, App content, Data safety (owner step GP4)`;
  if (!input.isAdsEnabled) {
    return [
      header,
      'Does your app collect or share any of the required user data types? No: ads are off and our own code collects nothing',
      'Advertising ID (App content): No',
    ];
  }
  return [
    header,
    'Does your app collect or share any of the required user data types? Yes: the ads SDK (Google Mobile Ads) does; our own code collects nothing',
    'Is all of the user data collected by your app encrypted in transit? Yes',
    'Do you provide a way for users to request that their data is deleted? No: there is no account to delete, and our own code stores nothing off the phone',
    ...ADS_SDK_TYPES.map((type) => `${type}: collected and shared by the ads SDK, for advertising`),
    'Every other data type (personal info, financial info, messages, photos, audio, files, calendar, contacts, health, web browsing): not collected',
    'Advertising ID (App content): Yes, the app uses an advertising ID, for advertising',
  ];
}
