// Phase 2 level data. Each level is just a target word to produce via a
// swap and a swap budget to do it in — kept as plain data (PLAN.md §15,
// Phase 6) so new levels don't require touching BoardScene's logic.
//
// NOTE on solvability: today nothing guarantees a given targetWord is
// actually reachable within maxSwaps on a random board — that's the "still
// open" risk called out in PLAN.md under Open technical risk. Picked short,
// common, high-frequency-letter words here to keep the odds good in the
// meantime; a real per-level solver/playtest pass is a follow-up.
export const LEVELS = [
  { id: 1, targetWord: 'BAG', maxSwaps: 15 },
  { id: 2, targetWord: 'CAT', maxSwaps: 15 },
  { id: 3, targetWord: 'GARDEN', maxSwaps: 25 },
];

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

export function getNextLevelId(id) {
  const index = LEVELS.findIndex((l) => l.id === id);
  if (index === -1 || index === LEVELS.length - 1) return null;
  return LEVELS[index + 1].id;
}
