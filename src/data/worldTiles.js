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
// All ten worlds have a row so the scene stays data-driven. BoardScene still
// treats null paths or an unloaded texture as a signal to use the original
// colored rectangle, keeping the fallback safe if an asset is ever removed.

export const WORLD_TILES = {
  1: {
    tileKey: 'tile-candy-garden',
    tilePath: 'assets/tile-candy-garden.png',
    bossTileKey: 'tile-candy-garden-boss',
    bossTilePath: 'assets/tile-candy-garden-boss.png',
  },
  2: {
    tileKey: 'tile-jungle-jumble',
    tilePath: 'assets/tile-jungle-jumble.png',
    bossTileKey: 'tile-jungle-jumble-boss',
    bossTilePath: 'assets/tile-jungle-jumble-boss.png',
  },
  3: {
    tileKey: 'tile-ocean-words',
    tilePath: 'assets/tile-ocean-words.png',
    bossTileKey: 'tile-ocean-words-boss',
    bossTilePath: 'assets/tile-ocean-words-boss.png',
  },
  4: {
    tileKey: 'tile-dino-valley',
    tilePath: 'assets/tile-dino-valley.png',
    bossTileKey: 'tile-dino-valley-boss',
    bossTilePath: 'assets/tile-dino-valley-boss.png',
  },
  5: {
    tileKey: 'tile-cloud-kingdom',
    tilePath: 'assets/tile-cloud-kingdom.png',
    bossTileKey: 'tile-cloud-kingdom-boss',
    bossTilePath: 'assets/tile-cloud-kingdom-boss.png',
  },
  6: {
    tileKey: 'tile-crystal-forest',
    tilePath: 'assets/tile-crystal-forest.png',
    bossTileKey: 'tile-crystal-forest-boss',
    bossTilePath: 'assets/tile-crystal-forest-boss.png',
  },
  7: {
    tileKey: 'tile-magic-mountain',
    tilePath: 'assets/tile-magic-mountain.png',
    bossTileKey: 'tile-magic-mountain-boss',
    bossTilePath: 'assets/tile-magic-mountain-boss.png',
  },
  8: {
    tileKey: 'tile-space-words',
    tilePath: 'assets/tile-space-words.png',
    bossTileKey: 'tile-space-words-boss',
    bossTilePath: 'assets/tile-space-words-boss.png',
  },
  9: {
    tileKey: 'tile-ancient-valley',
    tilePath: 'assets/tile-ancient-valley.png',
    bossTileKey: 'tile-ancient-valley-boss',
    bossTilePath: 'assets/tile-ancient-valley-boss.png',
  },
  10: {
    tileKey: 'tile-wordswoop-kingdom',
    tilePath: 'assets/tile-wordswoop-kingdom.png',
    bossTileKey: 'tile-wordswoop-kingdom-boss',
    bossTilePath: 'assets/tile-wordswoop-kingdom-boss.png',
  },
};

export function getWorldTile(worldId) {
  return WORLD_TILES[worldId] ?? null;
}
