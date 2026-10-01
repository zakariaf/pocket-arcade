// packages/shell/src/core/core.ts
import { create } from 'zustand';

import { double } from './util.ts';

export const coreStore = create(() => ({ value: double(1) }));
