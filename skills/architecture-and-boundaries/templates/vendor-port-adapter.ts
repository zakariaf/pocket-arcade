// packages/shell/src/services/__PORT_FOLDER__/__VENDOR__-__PORT_FOLDER__-adapter.ts
// The ONLY file that imports __VENDOR_SDK__ (the ESLint ADAPTERS exemption matches *-adapter.ts in
// services/<port>/). It maps every SDK answer and error to the port's vendor-neutral types.
// An SDK call that can hang gets a timeout here (a `timed-out` Result, never a throw): play never
// waits on the network.
import { __VENDOR_CALL__ } from '__VENDOR_SDK__';

import { err, ok } from '@e07/game-kit/contract/result.ts';

import type { __PORT_NAME__Port } from './__PORT_FOLDER__-port.ts';

/** Maps the SDK's answer to the port's vendor-neutral value. */
function toValue(answer: Awaited<ReturnType<typeof __VENDOR_CALL__>>): __VALUE_TYPE__ {
  return __MAPPING_EXPRESSION__;
}

/** Creates the device __PORT_NAME__Port. Called once, by createShellApp. */
export function create__VENDOR_PASCAL____PORT_NAME__Adapter(): __PORT_NAME__Port {
  return {
    __QUERY__: async () => {
      try {
        return ok(toValue(await Promise.resolve(__VENDOR_CALL__())));
      } catch (error: unknown) {
        return err({
          kind: 'unavailable',
          reason: error instanceof Error ? error.message : 'unknown',
        });
      }
    },
  };
}
