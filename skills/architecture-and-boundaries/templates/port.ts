// packages/shell/src/services/__PORT_FOLDER__/__PORT_FOLDER__-port.ts
// A port: the Shell's vendor-neutral view of one external service. No SDK type appears here;
// only __VENDOR__-__PORT_FOLDER__-adapter.ts imports the SDK.
import type { Result } from '@e07/game-kit/contract/result.ts';

/** An expected failure of the service: a kebab-case kind union, never a thrown error. */
export type __PORT_NAME__Failure = { readonly kind: 'unavailable'; readonly reason: string };

/** __PORT_SUMMARY__ */
export type __PORT_NAME__Port = {
  /** __QUERY_SUMMARY__ Resolves with a Result; never rejects. */
  readonly __QUERY__: () => Promise<Result<__VALUE_TYPE__, __PORT_NAME__Failure>>;
};
