// packages/shell/src/config/with-shell.test.ts (fixture: a test may name the tracking keys)
import { withShell } from './with-shell.ts';

it('writes the tracking text in every language, never through the AdMob plugin', () => {
  const locales = withShell().locales as Record<string, { ios: Record<string, string> }>;
  expect(locales['fa']?.ios['NSUserTrackingUsageDescription']).toBeTruthy();
  expect(JSON.stringify(withShell().plugins)).not.toContain('userTrackingUsageDescription');
});
