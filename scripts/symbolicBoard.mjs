// Offline level-generator core, part 1: a DETERMINISTIC board simulation
// that a real search can trust.
//
// Why this exists (see update.md Milestone 9): generateGuaranteedBoard()'s
// "solvable by reversing the scramble" claim doesn't hold in real play,
// because a word-forming swap doesn't reposition tiles, it DESTROYS the
// matched ones (clearTiles + collapseAndRefill: they're removed, the
// column falls, and brand-new RANDOM letters enter from the top). Any
// offline-found "solution path" that secretly assumes a specific refilled
// letter is not actually a guarantee - a real player's RNG will differ.
//
// The fix: every cell is either a KNOWN letter (traceable back to the
// fixed starting board, possibly having moved via earlier swaps) or
// POISONED (its value became unknown the moment it was cleared and
// refilled). The search built on top of this (symbolicSolve.mjs, next
// batch) is only ever allowed to rely on known cells - a poisoned cell is
// never counted on to legally complete a word, even though in real play
// it might get lucky. That keeps every found path correct regardless of
// what the player's actual random refills turn out to be. The cost is
// conservatism: this may reject some paths a real (lucky) player could
// pull off, but it never claims a path works when it might not.
//
// Mirrors BoardScene.js rules exactly where it matters:
// - scanLineForWords: forward AND reverse substrings (post Milestone 9 fix)
// - collapseAndRefill: survivors keep relative order, shift to the BOTTOM
//   of the column, new/poisoned cells enter at the TOP
// - cascades chain until no more matches - but here, only KNOWN matches
//   ever chain; a poisoned cell coincidentally completing a word in real
//   play is a bonus the search doesn't (and can't) rely on

import { BOARD_SIZE, MIN_WORD_LENGTH, MAX_WORD_LENGTH } from '../src/config.js';
import { WORD_SET } from '../src/data/wordlist.js';

export const POISONED = null; // sentinel: "cell's real letter is unknown"

// ---------- pure helpers on a plain grid (row-major array of arrays) ----------

export function cloneBoard(grid) {
  return grid.map((row) => [...row]);
}

// Scans one line (row or column, array of cell values - letters or
// POISONED) for dictionary words. A POISONED cell acts as an opaque break:
// it splits the line into known-only segments, and only those segments are
// searched - we never guess what a poisoned cell might spell. Matches both
// reading directions (mirrors the real scanLineForWords post-Milestone-9).
// Returns [{ start, length, word, wasReversed }, ...] in scan order, same
// greedy longest-match-then-jump-past behavior as the real game.
export function scanLineForWordsSymbolic(letters) {
  const found = [];
  let i = 0;
  while (i < letters.length) {
    let matchedLen = 0;
    if (letters[i] !== POISONED) {
      // maxLen is capped by both MAX_WORD_LENGTH and the next poisoned
      // cell (or line end), whichever comes first - never scan across a
      // poisoned cell.
      let boundary = i;
      while (boundary < letters.length && letters[boundary] !== POISONED) boundary++;
      const maxLen = Math.min(MAX_WORD_LENGTH, boundary - i);
      for (let len = maxLen; len >= MIN_WORD_LENGTH; len--) {
        const segment = letters.slice(i, i + len).join('');
        if (WORD_SET.has(segment)) {
          found.push({ start: i, length: len, word: segment, wasReversed: false });
          matchedLen = len;
          break;
        }
        const reversed = segment.split('').reverse().join('');
        if (WORD_SET.has(reversed)) {
          found.push({ start: i, length: len, word: reversed, wasReversed: true });
          matchedLen = len;
          break;
        }
      }
    }
    i += matchedLen > 0 ? matchedLen : 1;
  }
  return found;
}

// Full-board scan. Returns { matchedCells: Set<"r,c">, wordsFound: string[] }
// exactly like BoardScene.js's findWordMatches (the real name there is
// inline in attemptSwap/resolveAutoMatches - this is the shared shape).
export function findWordMatchesSymbolic(grid) {
  const matchedCells = new Set();
  const wordsFound = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (const m of scanLineForWordsSymbolic(grid[row])) {
      wordsFound.push(m.word);
      for (let c = m.start; c < m.start + m.length; c++) matchedCells.add(`${row},${c}`);
    }
  }
  for (let col = 0; col < BOARD_SIZE; col++) {
    const colLetters = grid.map((r) => r[col]);
    for (const m of scanLineForWordsSymbolic(colLetters)) {
      wordsFound.push(m.word);
      for (let r = m.start; r < m.start + m.length; r++) matchedCells.add(`${r},${col}`);
    }
  }
  return { matchedCells, wordsFound };
}

// Applies a clear+collapse to `grid` IN PLACE for the given matched cells,
// mirroring collapseAndRefill: survivors (non-matched cells) keep their
// relative order and shift to the BOTTOM of the column; the vacated TOP
// slots become POISONED (unknown - a real refill will put a random letter
// there, but the search can never assume which one).
export function clearAndCollapseSymbolic(grid, matchedCells) {
  for (let col = 0; col < BOARD_SIZE; col++) {
    const survivors = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      if (!matchedCells.has(`${row},${col}`)) survivors.push(grid[row][col]);
    }
    const poisonedCount = BOARD_SIZE - survivors.length;
    const newColumn = [...Array(poisonedCount).fill(POISONED), ...survivors];
    for (let row = 0; row < BOARD_SIZE; row++) grid[row][col] = newColumn[row];
  }
}

// Resolves a full cascade chain starting from whatever's already on the
// board (no swap - used right after a clear+collapse to chain further
// KNOWN-only matches, same as resolveAutoMatches's recursion). Mutates
// `grid` in place. Returns the total number of cascade rounds applied
// (0 if nothing chained), purely for diagnostics - the search doesn't
// need to reason about score, only reachability.
export function resolveCascadesSymbolic(grid) {
  let rounds = 0;
  while (true) {
    const { matchedCells } = findWordMatchesSymbolic(grid);
    if (matchedCells.size === 0) break;
    clearAndCollapseSymbolic(grid, matchedCells);
    rounds += 1;
  }
  return rounds;
}

// Attempts one swap on a symbolic board. Returns null if the swap is
// illegal (either cell is POISONED - we refuse to rely on an unknown
// value's legality even though it might work in real play; or the swap
// doesn't form any known word, matching the real bounce-back). Otherwise
// returns a NEW grid (does not mutate the input) with the swap applied,
// matched cells cleared, columns collapsed, and any further KNOWN cascade
// chained - i.e. the state right after this move fully resolves, same as
// what a real player would see settle before their next move.
export function trySwapSymbolic(grid, r1, c1, r2, c2) {
  if (grid[r1][c1] === POISONED || grid[r2][c2] === POISONED) return null;

  const next = cloneBoard(grid);
  const tmp = next[r1][c1];
  next[r1][c1] = next[r2][c2];
  next[r2][c2] = tmp;

  const { matchedCells, wordsFound } = findWordMatchesSymbolic(next);
  if (matchedCells.size === 0) return null; // bounces back in the real game - not a legal move

  clearAndCollapseSymbolic(next, matchedCells);
  resolveCascadesSymbolic(next);

  return { grid: next, wordsFound };
}

export function allAdjacentPairs() {
  const pairs = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (col + 1 < BOARD_SIZE) pairs.push([row, col, row, col + 1]);
      if (row + 1 < BOARD_SIZE) pairs.push([row, col, row + 1, col]);
    }
  }
  return pairs;
}

// All legal next states from a given symbolic board - i.e. every swap
// that isn't blocked by a poisoned cell and does form a known word.
export function allLegalMovesSymbolic(grid) {
  const moves = [];
  for (const [r1, c1, r2, c2] of allAdjacentPairs()) {
    const result = trySwapSymbolic(grid, r1, c1, r2, c2);
    if (result) moves.push({ r1, c1, r2, c2, ...result });
  }
  return moves;
}

// Does `targetWord` appear as a straight run of KNOWN cells (any reading
// direction), forward or reverse-credited exactly like the real game's
// checkWinCondition would see it via wordsFound?
export function targetWordPresentSymbolic(grid, targetWord) {
  for (let row = 0; row < BOARD_SIZE; row++) {
    if (scanLineForWordsSymbolic(grid[row]).some((m) => m.word === targetWord)) return true;
  }
  for (let col = 0; col < BOARD_SIZE; col++) {
    const colLetters = grid.map((r) => r[col]);
    if (scanLineForWordsSymbolic(colLetters).some((m) => m.word === targetWord)) return true;
  }
  return false;
}
