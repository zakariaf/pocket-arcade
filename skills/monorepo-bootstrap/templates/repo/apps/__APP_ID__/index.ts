// apps/__GAME_ID__/index.ts
// Placeholder entry: an empty app, so the skeleton type-checks, lints and prebuilds while the game
// module is written. Once src/index.ts assembles the module and the Shell boot exists
// (packages/shell/src/app/start-shell.ts), this file becomes the 3-line entry: import startShell,
// import the module from ./src/index.ts, call startShell(module).
import { registerRootComponent } from 'expo';

function PlaceholderApp(): null {
  return null;
}

registerRootComponent(PlaceholderApp);
