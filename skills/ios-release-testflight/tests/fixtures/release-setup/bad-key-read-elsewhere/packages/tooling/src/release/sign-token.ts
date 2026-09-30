// Wrong: only asc-credentials.ts reads the key.
import { readFileSync } from 'node:fs';

import { ascKeyPath } from '@e07/tooling/asc/asc-credentials.ts';

export const pem = readFileSync(ascKeyPath('2X9R4HXF34'), 'utf8');
