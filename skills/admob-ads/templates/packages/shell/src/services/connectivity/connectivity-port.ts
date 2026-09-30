// packages/shell/src/services/connectivity/connectivity-port.ts
export type ConnectivityPort = {
  readonly isOnline: () => boolean; // last known value; false until the first report
  readonly subscribe: (listener: (isOnline: boolean) => void) => () => void;
};
