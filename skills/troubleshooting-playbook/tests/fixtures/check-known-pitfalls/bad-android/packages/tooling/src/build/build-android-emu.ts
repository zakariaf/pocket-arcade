// packages/tooling/src/build/build-android-emu.ts (excerpt)
import { join } from 'node:path';

// Planted: Gradle runs Metro without the variant variables, so the store APK keys its cache
// and its test gate on the fallback 'test'.
export function gradleStep(appDir: string, toolEnv: NodeJS.ProcessEnv) {
  return { cwd: appDir, env: toolEnv, file: join('android', 'gradlew'), args: ['-p', 'android', 'assembleRelease'] };
}
