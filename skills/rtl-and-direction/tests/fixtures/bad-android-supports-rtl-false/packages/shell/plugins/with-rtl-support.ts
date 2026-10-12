// packages/shell/plugins/with-rtl-support.ts
// Planted bug: Android's right-to-left support is turned off (android:supportsRtl false).
type Manifest = { readonly application: { $: Record<string, string> } };

export function keepRtlSupport(manifest: Manifest): Manifest {
  manifest.application.$['android:supportsRtl'] = 'false';
  return manifest;
}
