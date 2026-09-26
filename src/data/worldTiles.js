// Per-world letter-tile art. Each tile is a neutral white/light-grayscale
// sprite with its shape, bevels, and highlights baked in; BoardScene applies
// LETTER_COLORS at runtime with Phaser setTint(), preserving the existing
// rainbow-per-letter gameplay language without needing 26 files per world.
//
// Boss tile art is intentionally independent from worldFrames.js's boss
// rule: tile bosses are every local level divisible by 5 (5/10/15/20), while
// frame/progress rules that currently treat only level 20 as a boss remain
// unchanged.
//
// All ten worlds have a row from the start so adding art stays data-only.
// Null paths mean that world is not commissioned yet; BoardScene gracefully
// keeps the original colored rectangle for that world rather than attempting
// to load or render a missing texture.

export const WORLD_TILES = {
  1: {
    tileKey: 'tile-candy-garden',
    tilePath: 'assets/tile-candy-garden.png',
    bossTileKey: 'tile-candy-garden-boss',
    bossTilePath: 'assets/tile-candy-garden-boss.png',
  },
  2: { tileKey: null, tilePath: null, bossTileKey: null, bossTilePath: null }, // Jungle Jumble
  3: { tileKey: null, tilePath: null, bossTileKey: null, bossTilePath: null }, // Ocean Words
  4: { tileKey: null, tilePath: null, bossTileKey: null, bossTilePath: null }, // Dino Valley
  5: { tileKey: null, tilePath: null, bossTileKey: null, bossTilePath: null }, // Cloud Kingdom
  6: { tileKey: null, tilePath: null, bossTileKey: null, bossTilePath: null }, // Crystal Forest
  7: { tileKey: null, tilePath: null, bossTileKey: null, bossTilePath: null }, // Magic Mountain
  8: { tileKey: null, tilePath: null, bossTileKey: null, bossTilePath: null }, // Space Words
  9: { tileKey: null, tilePath: null, bossTileKey: null, bossTilePath: null }, // Ancient Valley
  10: { tileKey: null, tilePath: null, bossTileKey: null, bossTilePath: null }, // WordSwoop Kingdom
};

export function getWorldTile(worldId) {
  return WORLD_TILES[worldId] ?? null;
}
