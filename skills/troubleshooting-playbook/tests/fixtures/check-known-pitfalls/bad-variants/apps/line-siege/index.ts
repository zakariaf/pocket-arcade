// apps/line-siege/index.ts
import { reloadAppAsync } from 'expo';

import { startShell } from '@e07/shell/app/start-shell.ts';

void reloadAppAsync('direction');
startShell();
