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
// Levels 1-4 are free-play, level 5 is the one target-word level —
// matches the "every 5th level is type:'target'" rule. Previously
// levels 1-3 were ALSO target-word (BAG, CAT, GARDEN) — leftover
// solvability test levels from before that rule was decided, never
// fixed once the rule landed. Per chat, folded 1-3 back into free-play
// (score targets ramping 200 -> 500) and moved the one remaining
// target-word level to id 5, using BAG rather than GARDEN — PLAN.md §3
// says early levels should use short, common target words, and BAG/CAT
// were the "early" examples given there; GARDEN (6 letters, the
// board's max) reads as a later-world difficulty, not a level-5 one.
// Real content authoring for the full 200-level list is still open
// (see PLAN.md §16 Phase 6) — this is just fixing what the 5 demo
// levels are, not that authoring pass.
export const LEVELS = [
  { id: 1, type: 'free', scoreTarget: 200, maxSwaps: 12 },
  { id: 2, type: 'free', scoreTarget: 300, maxSwaps: 14 },
  { id: 3, type: 'free', scoreTarget: 400, maxSwaps: 16 },
  { id: 4, type: 'free', scoreTarget: 500, maxSwaps: 18 },
  { id: 5, type: 'target', targetWord: 'BAG', maxSwaps: 15 },
];

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

export function getNextLevelId(id) {
  const index = LEVELS.findIndex((l) => l.id === id);
  if (index === -1 || index === LEVELS.length - 1) return null;
  return LEVELS[index + 1].id;
}
