// jest.setup.ts (fixture: the mock still commented out after icon-raster.ts was copied)
// Once packages/shell/src/ui/icons/icon-raster.ts exists, add (a jest.mock of a module that does not
// exist yet fails this setup file for every suite):
// jest.mock('@e07/shell/ui/icons/icon-raster.ts', () => ({
//   getIconUri: () => 'data:image/png;base64,',
// }));
