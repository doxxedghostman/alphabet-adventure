// Level data — kept as plain data (PLAN.md §15, Phase 6) so new levels
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
//   - type: 'free'      — normal free-play board (any word counts, no
//                         fixed target). Not yet represented in this file;
//                         free-play levels will need their own objective
//                         shape (e.g. score/move-limit) as a follow-up —
//                         only the target-word levels were blocked on
//                         solvability, so that's what got built first.
//
// scrambleCount is optional per-level — omit it to use the
// SCRAMBLE_COUNT_BY_LENGTH default for that word's length. Override it
// once playtesting finds the per-length sweet spot isn't right for a
// specific word.
export const LEVELS = [
  { id: 1, type: 'target', targetWord: 'BAG', maxSwaps: 15 },
  { id: 2, type: 'target', targetWord: 'CAT', maxSwaps: 15 },
  { id: 3, type: 'target', targetWord: 'GARDEN', maxSwaps: 25 },
];

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

export function getNextLevelId(id) {
  const index = LEVELS.findIndex((l) => l.id === id);
  if (index === -1 || index === LEVELS.length - 1) return null;
  return LEVELS[index + 1].id;
}
