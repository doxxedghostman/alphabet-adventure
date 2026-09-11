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
// NOTE: ids below don't yet follow the final "every 5th level is
// type:'target'" numbering (1-3 are target-word test levels from before
// that decision, 4/5 are free-play demo levels added to prove the type
// works) — renumbering/authoring the full 200-level list in the
// 5th-level pattern is separate future content work, not done here.
export const LEVELS = [
  { id: 1, type: 'target', targetWord: 'BAG', maxSwaps: 15 },
  { id: 2, type: 'target', targetWord: 'CAT', maxSwaps: 15 },
  { id: 3, type: 'target', targetWord: 'GARDEN', maxSwaps: 25 },
  { id: 4, type: 'free', scoreTarget: 300, maxSwaps: 15 },
  { id: 5, type: 'free', scoreTarget: 600, maxSwaps: 18 },
];

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

export function getNextLevelId(id) {
  const index = LEVELS.findIndex((l) => l.id === id);
  if (index === -1 || index === LEVELS.length - 1) return null;
  return LEVELS[index + 1].id;
}
