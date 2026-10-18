// packages/tooling/src/build/build-android-emu.ts (excerpt)
import { join } from 'node:path';

import { GRADLE_RELEASE_ARGS, variantEnv, type BuildVariant } from '@e07/tooling/build/emu-build-plan.ts';

export function gradleStep(appDir: string, toolEnv: NodeJS.ProcessEnv, variant: BuildVariant) {
  // One environment for the whole run: Metro inside Gradle reads the variant.
  const env = { ...toolEnv, ...variantEnv(variant) };
  return { cwd: appDir, env, file: join('android', 'gradlew'), args: ['-p', 'android', ...GRADLE_RELEASE_ARGS] };
}
