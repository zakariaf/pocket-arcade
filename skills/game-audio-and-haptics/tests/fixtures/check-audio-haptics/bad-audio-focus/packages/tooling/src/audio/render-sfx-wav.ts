// packages/tooling/src/audio/render-sfx-wav.ts
// device-only: covered by the owner's listening check of the WAVs it writes (a command-line entry; encode-wav.test.ts and synthesize-recipe.test.ts prove its parts).
// Usage: node packages/tooling/src/audio/render-sfx-wav.ts --app line-siege
// Writes apps/<app>/sfx-preview/<sound-id>.wav (gitignored) so the owner can listen in Finder.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { synthesizeRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';

import { encodeWav } from './encode-wav.ts';

import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';

const SAMPLE_RATE = 48_000;

const { values } = parseArgs({ options: { app: { type: 'string' } } });
const app = values.app ?? '';
if (!/^[a-z][a-z0-9-]*$/.test(app)) throw new Error('Pass --app <game-id>, e.g. --app line-siege');

const { SOUND_BANK: bank } = (await import(`@e07/${app}/sounds/sound-bank.ts`)) as {
  readonly SOUND_BANK?: SoundBank;
};
if (bank === undefined)
  throw new Error(`apps/${app}/src/sounds/sound-bank.ts must export SOUND_BANK`);

const outDir = join('apps', app, 'sfx-preview');
mkdirSync(outDir, { recursive: true });
for (const [id, spec] of Object.entries(bank)) {
  const samples = synthesizeRecipe(spec.recipe, SAMPLE_RATE);
  writeFileSync(join(outDir, `${id}.wav`), encodeWav(samples, SAMPLE_RATE));
  console.log(`${id}.wav  ${String(Math.round((samples.length / SAMPLE_RATE) * 1000))} ms`);
}
