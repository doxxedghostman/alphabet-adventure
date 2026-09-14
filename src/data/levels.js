// Level data — kept as plain data (PLAN.md §16, Phase 6) so new levels
// don't require touching BoardScene's logic.
//
// Two level types (decided after the target-word solvability discussion):
//   - type: 'target'    — every 5th level (40 of the planned 200 total).
//                         Board is built by generateGuaranteedBoard()
//                         (src/utils/levelGenerator.js), which places the
//                         word solved then scrambles it a known number of
//                         swaps — so it's PROVABLY reachable within
//                         maxSwaps, not just "probably" like the old
//                         random-fill approach. This is what used to be
//                         the "still open" solvability risk — resolved.
//                         Fields: targetWord, maxSwaps, scrambleCount
//                         (optional override).
//   - type: 'free'      — the other 160 of the planned 200. Objective is
//                         SCORE TARGET: reach `scoreTarget` points within
//                         `maxSwaps` swaps, any words count (no fixed
//                         word). Chosen over "find N words" or a flat
//                         move-limit-only objective because it reuses the
//                         scoring math that already exists (word.length *
//                         20 per direct word, *10 per chained cascade
//                         word) rather than needing a new counter, and it
//                         sets up the §14 3-star meter system for free —
//                         a score target IS a star threshold. Board uses
//                         the plain random fill (createInitialBoard's
//                         non-target branch) since there's no specific
//                         word to guarantee reachable.
//
// scrambleCount is optional per target-word level — omit it to use the
// SCRAMBLE_COUNT_BY_LENGTH default for that word's length. Override it
// once playtesting finds the per-length sweet spot isn't right for a
// specific word.
//
// Levels 1-60 are authored so far (Candy Garden and beyond — see worlds.js/progressStore.js's LEVELS_PER_WORLD): every 5th level is type:'target', the rest are type:'free' with ramping score targets. Real content authoring for the remaining 140 of the planned 200-level list is still open (see PLAN.md §16 Phase 6).
export const LEVELS = [
  { id: 1, type: 'free', scoreTarget: 200, maxSwaps: 12 },
  { id: 2, type: 'free', scoreTarget: 300, maxSwaps: 14 },
  { id: 3, type: 'free', scoreTarget: 400, maxSwaps: 16 },
  { id: 4, type: 'free', scoreTarget: 500, maxSwaps: 18 },
  { id: 5, type: 'target', targetWord: 'BAG', maxSwaps: 15 },
  { id: 6, type: 'free', scoreTarget: 600, maxSwaps: 18 },
  { id: 7, type: 'free', scoreTarget: 700, maxSwaps: 18 },
  { id: 8, type: 'free', scoreTarget: 800, maxSwaps: 19 },
  { id: 9, type: 'free', scoreTarget: 900, maxSwaps: 19 },
  { id: 10, type: 'target', targetWord: 'CAT', maxSwaps: 15 },
  { id: 11, type: 'free', scoreTarget: 1000, maxSwaps: 20 },
  { id: 12, type: 'free', scoreTarget: 1100, maxSwaps: 20 },
  { id: 13, type: 'free', scoreTarget: 1200, maxSwaps: 21 },
  { id: 14, type: 'free', scoreTarget: 1300, maxSwaps: 21 },
  { id: 15, type: 'target', targetWord: 'DOG', maxSwaps: 15 },
  { id: 16, type: 'free', scoreTarget: 1400, maxSwaps: 22 },
  { id: 17, type: 'free', scoreTarget: 1500, maxSwaps: 22 },
  { id: 18, type: 'free', scoreTarget: 1600, maxSwaps: 23 },
  { id: 19, type: 'free', scoreTarget: 1700, maxSwaps: 23 },
  { id: 20, type: 'target', targetWord: 'SUN', maxSwaps: 15 },
  { id: 21, type: 'free', scoreTarget: 1800, maxSwaps: 24 },
  { id: 22, type: 'free', scoreTarget: 1900, maxSwaps: 24 },
  { id: 23, type: 'free', scoreTarget: 2000, maxSwaps: 25 },
  { id: 24, type: 'free', scoreTarget: 2100, maxSwaps: 25 },
  { id: 25, type: 'target', targetWord: 'HAT', maxSwaps: 15 },
  { id: 26, type: 'free', scoreTarget: 2200, maxSwaps: 26 },
  { id: 27, type: 'free', scoreTarget: 2300, maxSwaps: 26 },
  { id: 28, type: 'free', scoreTarget: 2400, maxSwaps: 27 },
  { id: 29, type: 'free', scoreTarget: 2500, maxSwaps: 27 },
  { id: 30, type: 'target', targetWord: 'PIG', maxSwaps: 15 },
  { id: 31, type: 'free', scoreTarget: 2600, maxSwaps: 28 },
  { id: 32, type: 'free', scoreTarget: 2700, maxSwaps: 28 },
  { id: 33, type: 'free', scoreTarget: 2800, maxSwaps: 29 },
  { id: 34, type: 'free', scoreTarget: 2900, maxSwaps: 29 },
  { id: 35, type: 'target', targetWord: 'COW', maxSwaps: 15 },
  { id: 36, type: 'free', scoreTarget: 3000, maxSwaps: 30 },
  { id: 37, type: 'free', scoreTarget: 3100, maxSwaps: 30 },
  { id: 38, type: 'free', scoreTarget: 3200, maxSwaps: 31 },
  { id: 39, type: 'free', scoreTarget: 3300, maxSwaps: 31 },
  { id: 40, type: 'target', targetWord: 'BEE', maxSwaps: 15 },
  { id: 41, type: 'free', scoreTarget: 3400, maxSwaps: 32 },
  { id: 42, type: 'free', scoreTarget: 3500, maxSwaps: 32 },
  { id: 43, type: 'free', scoreTarget: 3600, maxSwaps: 33 },
  { id: 44, type: 'free', scoreTarget: 3700, maxSwaps: 33 },
  { id: 45, type: 'target', targetWord: 'FOX', maxSwaps: 15 },
  { id: 46, type: 'free', scoreTarget: 3800, maxSwaps: 34 },
  { id: 47, type: 'free', scoreTarget: 3900, maxSwaps: 34 },
  { id: 48, type: 'free', scoreTarget: 4000, maxSwaps: 35 },
  { id: 49, type: 'free', scoreTarget: 4100, maxSwaps: 35 },
  { id: 50, type: 'target', targetWord: 'HEN', maxSwaps: 15 },
  { id: 51, type: 'free', scoreTarget: 4200, maxSwaps: 36 },
  { id: 52, type: 'free', scoreTarget: 4300, maxSwaps: 36 },
  { id: 53, type: 'free', scoreTarget: 4400, maxSwaps: 37 },
  { id: 54, type: 'free', scoreTarget: 4500, maxSwaps: 37 },
  { id: 55, type: 'target', targetWord: 'OWL', maxSwaps: 15 },
  { id: 56, type: 'free', scoreTarget: 4600, maxSwaps: 38 },
  { id: 57, type: 'free', scoreTarget: 4700, maxSwaps: 38 },
  { id: 58, type: 'free', scoreTarget: 4800, maxSwaps: 39 },
  { id: 59, type: 'free', scoreTarget: 4900, maxSwaps: 39 },
  { id: 60, type: 'target', targetWord: 'RAT', maxSwaps: 15 },
];

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

export function getNextLevelId(id) {
  const index = LEVELS.findIndex((l) => l.id === id);
  if (index === -1 || index === LEVELS.length - 1) return null;
  return LEVELS[index + 1].id;
}
