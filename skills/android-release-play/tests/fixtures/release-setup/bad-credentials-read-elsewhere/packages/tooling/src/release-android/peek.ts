// packages/tooling/src/release-android/peek.ts
import { readFileSync } from 'node:fs';

export const PEEK = (home: string): string => readFileSync(`${home}/.android-keys/play-service-account.json`, 'utf8');
