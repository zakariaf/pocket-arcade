// packages/tooling/src/deps/app-lockstep.ts

export type AppManifest = {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
};

function versionsByPackage(
  manifests: ReadonlyMap<string, AppManifest>,
): ReadonlyMap<string, ReadonlyMap<string, string>> {
  const byPackage = new Map<string, Map<string, string>>();
  for (const [app, manifest] of manifests) {
    const all = { ...manifest.dependencies, ...manifest.devDependencies };
    for (const [name, version] of Object.entries(all)) {
      const versions = byPackage.get(name) ?? new Map<string, string>();
      versions.set(app, version);
      byPackage.set(name, versions);
    }
  }
  return byPackage;
}

/**
 * Lists every package that two apps declare with different version specifiers
 * (all apps move in lockstep). Workspace links ("*") are ignored.
 */
export function findLockstepDrift(manifests: ReadonlyMap<string, AppManifest>): readonly string[] {
  return [...versionsByPackage(manifests)].flatMap(([name, versions]) => {
    const distinct = new Set([...versions.values()].filter((version) => version !== '*'));
    if (distinct.size <= 1) {
      return [];
    }
    const detail = [...versions].map(([app, version]) => `${app}=${version}`).join(', ');
    return [`${name} differs between apps: ${detail}`];
  });
}
