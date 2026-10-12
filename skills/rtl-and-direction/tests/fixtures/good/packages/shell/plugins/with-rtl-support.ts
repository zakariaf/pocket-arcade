// packages/shell/plugins/with-rtl-support.ts
// Fixture: a plugin that keeps Android's right-to-left support on (forceRTL needs it).
type Manifest = { readonly application: { $: Record<string, string> } };

export function keepRtlSupport(manifest: Manifest): Manifest {
  manifest.application.$['android:supportsRtl'] = 'true';
  return manifest;
}
