// packages/shell/src/services/save/schema/save-doc.ts
import { SAVE_DOC_V2 } from '@e07/shell/services/save/schema/save-doc-v2.ts';

import type { SaveDocV2 } from '@e07/shell/services/save/schema/save-doc-v2.ts';

/** Deeply immutable view of the latest document; reducers return new objects. */
export type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** The only place that names the latest version. Bump both lines together. */
export const LATEST_SAVE_VERSION = 2;
export const LATEST_SAVE_SCHEMA = SAVE_DOC_V2;
export type SaveDoc = DeepReadonly<SaveDocV2>;
export type SaveSettings = SaveDoc['settings'];
export type SaveRun = NonNullable<SaveDoc['run']>;
export type RunRef = SaveRun['ref'];
