// packages/shell/src/ui/game-tile.tsx
type IGameTileProps = { readonly label: string };
type Props = { readonly label: string };
type levelPack = { readonly id: string };
const maxUndoDepth = 200;
const modes = ['levels', 'daily'] as const;
const HEADER_RE = /^x$/u;
const pattern = /^y$/u;

/** Game tile. */
export function GameTile(props: Props, mirrored: boolean): React.JSX.Element {
  const loading: boolean = props.label === "";
  const onPress = (): void => {
    mirrored.toString();
  };
  const press = (): void => undefined;
  return <View onPress={press} onLongPress={onPress} />;
}

export class SQLDriver {}
export const isRTL = HEADER_RE.test(pattern.source) || maxUndoDepth > modes.length;
export type Unused = IGameTileProps | levelPack | typeof loading;
