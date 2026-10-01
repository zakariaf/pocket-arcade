// packages/shell/src/config/privacy-manifest.ts
// Aggregated required-reason APIs of every pod (checked by `npm run audit:privacy`, which
// fails when a pod's PrivacyInfo.xcprivacy declares a category/reason missing here).
// NSPrivacyTracking stays false and no NSPrivacyTrackingDomains are listed: our code tracks nothing,
// and Apple fails requests to listed domains for players who decline App Tracking Transparency,
// which would stop their ads. Google's own pods declare the tracking (Device ID); the app asks ATT
// before any ad request (owner decision O1).
export const PRIVACY_MANIFESTS = {
  NSPrivacyTracking: false,
  NSPrivacyAccessedAPITypes: [
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
      NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
    },
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
      NSPrivacyAccessedAPITypeReasons: ['C617.1'],
    },
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
      NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
    },
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
      NSPrivacyAccessedAPITypeReasons: ['E174.1'],
    },
  ],
};
