// packages/tooling/src/audit/android-manifest-audit.test.ts
import {
  ANDROID_PERMISSION_ALLOWLIST,
  manifestPermissions,
  manifestProblems,
} from './android-manifest-audit.ts';

// The merged release manifest (trimmed) of a game with ads, Premium and vibration.
const MANIFEST = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<manifest xmlns:android="http://schemas.android.com/apk/res/android"',
  '    xmlns:tools="http://schemas.android.com/tools" package="io.applander.linesiege">',
  '    <uses-permission android:name="android.permission.INTERNET" />',
  '    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
  '    <uses-permission android:name="com.google.android.gms.permission.AD_ID" />',
  '    <uses-permission android:name="com.android.vending.BILLING" />',
  '    <uses-permission android:name="android.permission.VIBRATE" />',
  '    <uses-permission android:name="android.permission.WAKE_LOCK" />',
  '    <uses-permission',
  '        android:name="io.applander.linesiege.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION" />',
  '    <uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove" />',
  '    <application android:allowBackup="true" android:supportsRtl="true">',
  '    </application>',
  '</manifest>',
].join('\n');

describe('the merged Android manifest (spec N3)', () => {
  it('reads every permission the app holds, without the removed ones', () => {
    expect(manifestPermissions(MANIFEST)).toStrictEqual([
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'com.google.android.gms.permission.AD_ID',
      'com.android.vending.BILLING',
      'android.permission.VIBRATE',
      'android.permission.WAKE_LOCK',
      'io.applander.linesiege.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
    ]);
  });

  it('passes the allowlisted permissions and no cleartext traffic', () => {
    expect(manifestProblems(MANIFEST)).toStrictEqual([]);
  });

  it('allows the five permissions the Shell needs and what the ads SDK declares', () => {
    expect(ANDROID_PERMISSION_ALLOWLIST).toStrictEqual([
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'com.google.android.gms.permission.AD_ID',
      'android.permission.ACCESS_ADSERVICES_AD_ID',
      'android.permission.ACCESS_ADSERVICES_ATTRIBUTION',
      'android.permission.ACCESS_ADSERVICES_TOPICS',
      'android.permission.WAKE_LOCK',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.FOREGROUND_SERVICE',
      'com.android.vending.BILLING',
      'android.permission.VIBRATE',
      '<package>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
    ]);
  });

  it('fails a permission outside the allowlist', () => {
    const manifest = MANIFEST.replace(
      '    <application',
      '    <uses-permission android:name="android.permission.READ_CONTACTS" />\n    <application',
    );
    expect(manifestProblems(manifest)).toStrictEqual([
      'permission android.permission.READ_CONTACTS is not on the allowlist',
    ]);
  });

  it("fails another package's receiver permission", () => {
    const manifest = MANIFEST.replace(
      'io.applander.linesiege.DYNAMIC',
      'com.example.other.DYNAMIC',
    );
    expect(manifestProblems(manifest)).toStrictEqual([
      'permission com.example.other.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION is not on the allowlist',
    ]);
  });

  it('fails cleartext traffic and a network security config', () => {
    const manifest = MANIFEST.replace(
      'android:allowBackup="true"',
      'android:allowBackup="true" android:usesCleartextTraffic="true" android:networkSecurityConfig="@xml/network"',
    );
    expect(manifestProblems(manifest)).toStrictEqual([
      'android:usesCleartextTraffic is true (plain HTTP)',
      'android:networkSecurityConfig is set (it can allow plain HTTP or user certificates)',
    ]);
  });

  it("fails Google's datatransport CCT backend, which uploads Play Billing's telemetry (spec N3)", () => {
    const manifest = MANIFEST.replace(
      '    </application>',
      [
        '        <service',
        '            android:name="com.google.android.datatransport.runtime.backends.TransportBackendDiscovery"',
        '            android:exported="false" >',
        '            <meta-data',
        '                android:name="backend:com.google.android.datatransport.cct.CctBackendFactory"',
        '                android:value="cct" />',
        '        </service>',
        '    </application>',
      ].join('\n'),
    );
    expect(manifestProblems(manifest)).toStrictEqual([
      "Google's datatransport CCT backend is registered (backend:com.google.android.datatransport.cct.CctBackendFactory): Play Billing would upload its telemetry from the app; withShell's with-no-google-telemetry plugin removes it",
    ]);
  });

  it('passes the discovery service once the CCT backend is removed', () => {
    const manifest = MANIFEST.replace(
      '    </application>',
      [
        '        <service',
        '            android:name="com.google.android.datatransport.runtime.backends.TransportBackendDiscovery"',
        '            android:exported="false" />',
        '    </application>',
      ].join('\n'),
    );
    expect(manifestProblems(manifest)).toStrictEqual([]);
  });

  it('fails a file that is not an Android manifest', () => {
    expect(manifestProblems('<plist></plist>')).toStrictEqual([
      'not an AndroidManifest.xml (no <manifest> element)',
    ]);
  });
});
