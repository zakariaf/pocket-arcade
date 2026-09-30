// jest.setup.ts (fixture: the root setup once icon-raster.ts exists)
jest.mock('@e07/shell/ui/icons/icon-raster.ts', () => ({
  getIconUri: () => 'data:image/png;base64,',
}));
