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

import { LEVELS_PER_WORLD, levelIdFor } from '../utils/progressStore.js';

export const WORLDS = [
  { id: 1, name: 'Candy Garden', slug: 'candy-garden' },
  { id: 2, name: 'Jungle Jumble', slug: 'jungle-jumble' },
  { id: 3, name: 'Ocean Words', slug: 'ocean-words' },
  { id: 4, name: 'Dino Valley', slug: 'dino-valley' },
  { id: 5, name: 'Cloud Kingdom', slug: 'cloud-kingdom' },
  { id: 6, name: 'Crystal Forest', slug: 'crystal-forest' },
  { id: 7, name: 'Magic Mountain', slug: 'magic-mountain' },
  { id: 8, name: 'Space Words', slug: 'space-words' },
  { id: 9, name: 'Ancient Valley', slug: 'ancient-valley' },
  { id: 10, name: 'WordSwoop Kingdom', slug: 'wordswoop-kingdom' },
].map((w) => ({
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
