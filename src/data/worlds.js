// World Map data (PLAN.md §8.5). One entry per world, in play order.
// `thumbKey`/`bgKey` are the Phaser texture keys WorldSelectScene and
// LevelPathScene load these under (see public/assets/<slug>-thumb.jpg
// and -bg.jpg — all 10 worlds' art is in place as of Milestone 12).
//
// levelStart/levelEnd are global level ids (see progressStore.js's
// levelIdFor/worldAndLevelFor) — world 1 owns 1-20, world 2 owns
// 21-40, and so on, using LEVELS_PER_WORLD from progressStore.js so
// the two files can't drift out of sync on that number.
//
// Only Candy Garden has any real level content behind it yet (5 demo
// levels in levels.js, ids 1-5) — every other world's ids will
// currently fall back to getLevel()'s default. That's fine for
// building/testing the World Map screens themselves; authoring real
// content per world is separate, already-tracked work (see update.md).
//
// gemColor: per-world tint applied to a single shared gem icon in
// WorldSelectScene, rather than needing 10 separate gem art assets.
// Picked to roughly match each world's mockup card (per chat).

import { LEVELS_PER_WORLD, levelIdFor } from '../utils/progressStore.js';

// `pathSpace` is the natural pixel size of that world's LevelPathScene
// background art (bgPath above), i.e. the coordinate space the node
// points in levelPaths.js are expressed in. All 10 worlds' art got
// vertically extended (600x900 -> 600x1700, mirror-tiling each one's
// own generic scenery band) per chat, so width-only scaling always
// covers the tallest supported device viewport with zero gap below
// it and zero side-cropping - see levelPaths.js's header comment for
// the full story and LevelPathScene.js for how it's applied.
const DEFAULT_PATH_SPACE = { width: 600, height: 1700 };

export const WORLDS = [
  { id: 1, name: 'Candy Garden', slug: 'candy-garden', gemColor: 0xff6fae },
  { id: 2, name: 'Jungle Jumble', slug: 'jungle-jumble', gemColor: 0x4caf50 },
  { id: 3, name: 'Ocean Words', slug: 'ocean-words', gemColor: 0x29b6f6 },
  { id: 4, name: 'Dino Valley', slug: 'dino-valley', gemColor: 0xffa726 },
  { id: 5, name: 'Cloud Kingdom', slug: 'cloud-kingdom', gemColor: 0xab47bc },
  { id: 6, name: 'Crystal Forest', slug: 'crystal-forest', gemColor: 0x26c6da },
  { id: 7, name: 'Magic Mountain', slug: 'magic-mountain', gemColor: 0x8e24aa },
  { id: 8, name: 'Space Words', slug: 'space-words', gemColor: 0x42a5f5 },
  { id: 9, name: 'Ancient Valley', slug: 'ancient-valley', gemColor: 0xffb300 },
  { id: 10, name: 'WordSwoop Kingdom', slug: 'wordswoop-kingdom', gemColor: 0xba68c8 },
].map((w) => ({
  pathSpace: DEFAULT_PATH_SPACE,
  ...w,
  thumbKey: `${w.slug}-thumb`,
  bgKey: `${w.slug}-bg`,
  thumbPath: `assets/${w.slug}-thumb.jpg`,
  bgPath: `assets/${w.slug}-bg.jpg`,
  levelStart: levelIdFor(w.id, 1),
  levelEnd: levelIdFor(w.id, LEVELS_PER_WORLD),
}));

export function getWorld(worldId) {
  return WORLDS.find((w) => w.id === worldId) ?? WORLDS[0];
}
