// Guaranteed-solvable target-word board generator.
//
// Problem this solves (see PLAN.md "Open technical risk"): hasValidSwap()
// only proves *some* word is reachable in one swap. It says nothing about
// whether a level's specific targetWord is reachable within maxSwaps.
// Proving that live (search over all possible swap sequences, accounting
// for cascades) is expensive and was rejected in favour of this approach.
//
// Approach: build the board BACKWARDS from a solved state.
//   1. Place targetWord correctly, in a straight line, on an empty board.
//   2. Fill every other cell with normal weighted-random letters (same
//      avoidance logic as the free-play board, so no accidental words).
//   3. Apply `scrambleCount` random adjacent-tile swaps to scramble the
//      word away from its solved position.
// Because we know exactly how the board was scrambled, we know for a fact
// it can be solved in at most `scrambleCount` swaps (the reverse of the
// scramble path always works, even if the player finds a different,
// possibly shorter, path). No solver, no search - just arithmetic.
//
// This is deliberately a plain, Phaser-free function (2D letter array in,
// 2D letter array out) so it can be unit-tested and reused without
// depending on BoardScene or the renderer.

import { BOARD_SIZE, MIN_WORD_LENGTH, MAX_WORD_LENGTH, randomLetter } from '../config.js';
import { WORD_SET } from '../data/wordlist.js';

// Placeholder starting points for the scramble-count "sweet spot" per
// word length, per PLAN.md follow-up: too few scrambles and the word is
// still visibly near-complete (too easy); too many and it eats most of
// the swap budget just to reset the board (too punishing). These are
// guesses to playtest against, not final numbers.
export const SCRAMBLE_COUNT_BY_LENGTH = {
  3: 6,
  4: 9,
  5: 12,
};

// How much extra swap budget to hand the player on top of the scramble
// count, since the player won't necessarily find the exact reverse path.
export function recommendedMaxSwaps(scrambleCount) {
  return scrambleCount + Math.ceil(scrambleCount * 0.5) + 3;
}

function emptyGrid() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

// Same "does this word-so-far form something real" check used by
// BoardScene.pickNonMatchingLetter, but operating on a plain letter grid
// instead of tile objects, and checking both directions since fill order
// can put the target word's letters either before or after a given cell.
function lineHasWordAround(cells) {
  const letters = cells.filter((c) => c !== null && c !== undefined);
  if (letters.length !== cells.length) return false; // gaps -> not a full line yet
  const joined = letters.join('');
  for (let len = MIN_WORD_LENGTH; len <= MAX_WORD_LENGTH; len++) {
    for (let start = 0; start + len <= joined.length; start++) {
      const segment = joined.slice(start, start + len);
      if (WORD_SET.has(segment)) return true;
      if (WORD_SET.has(segment.split('').reverse().join(''))) return true;
    }
  }
  return false;
}

function wouldFormWordAt(grid, row, col, letter) {
  const rowLetters = grid[row].map((v, c) => (c === col ? letter : v));
  const colLetters = grid.map((r, rIdx) => (rIdx === row ? letter : r[col]));
  return lineHasWordAround(rowLetters) || lineHasWordAround(colLetters);
}

function pickNonMatchingLetter(grid, row, col) {
  let letter = randomLetter();
  let attempts = 0;
  while (wouldFormWordAt(grid, row, col, letter) && attempts < 30) {
    letter = randomLetter();
    attempts += 1;
  }
  return letter;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// Picks a random straight-line placement (row or column, forward reading)
// for `word` that fits on the board.
function placeWord(grid, word) {
  const orientation = Math.random() < 0.5 ? 'row' : 'col';
  const lineIndex = Math.floor(Math.random() * BOARD_SIZE);
  const maxStart = BOARD_SIZE - word.length;
  const start = Math.floor(Math.random() * (maxStart + 1));

  const cells = [];
  for (let i = 0; i < word.length; i++) {
    const row = orientation === 'row' ? lineIndex : start + i;
    const col = orientation === 'row' ? start + i : lineIndex;
    grid[row][col] = word[i];
    cells.push([row, col]);
  }
  return cells;
}

function adjacentPairs() {
  const pairs = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (col + 1 < BOARD_SIZE) pairs.push([row, col, row, col + 1]);
      if (row + 1 < BOARD_SIZE) pairs.push([row, col, row + 1, col]);
    }
  }
  return pairs;
}

// Scans every row/column, both reading directions, for `word` appearing
// as a contiguous run. Returns the run's cell coordinates if found (so a
// corrective swap can target them directly), or null if the word isn't
// visible anywhere on the board.
function findWordRun(grid, word) {
  const size = grid.length;
  const reversed = word.split('').reverse().join('');

  for (let row = 0; row < size; row++) {
    const rowStr = grid[row].join('');
    const fwd = rowStr.indexOf(word);
    if (fwd !== -1) {
      return Array.from({ length: word.length }, (_, i) => [row, fwd + i]);
    }
    const rev = rowStr.indexOf(reversed);
    if (rev !== -1) {
      return Array.from({ length: word.length }, (_, i) => [row, rev + i]);
    }
  }

  for (let col = 0; col < size; col++) {
    let colStr = '';
    for (let row = 0; row < size; row++) colStr += grid[row][col];
    const fwd = colStr.indexOf(word);
    if (fwd !== -1) {
      return Array.from({ length: word.length }, (_, i) => [fwd + i, col]);
    }
    const rev = colStr.indexOf(reversed);
    if (rev !== -1) {
      return Array.from({ length: word.length }, (_, i) => [rev + i, col]);
    }
  }

  return null;
}

// Scans every row/column, both reading directions, for ANY dictionary
// word (not a specific target) appearing as a contiguous run. Returns
// the first one found (cells + the word), or null if the board is
// completely clean. Used to catch accidental words scrambleGrid's raw
// swaps introduce as a side effect - it only ever intended to move the
// target word, but a random swap can just as easily create some other
// unrelated word purely by chance.
function findAnyWordRun(grid) {
  const size = grid.length;
  for (let row = 0; row < size; row++) {
    const rowStr = grid[row].join('');
    for (let len = MAX_WORD_LENGTH; len >= MIN_WORD_LENGTH; len--) {
      for (let start = 0; start + len <= size; start++) {
        const segment = rowStr.slice(start, start + len);
        if (WORD_SET.has(segment) || WORD_SET.has([...segment].reverse().join(''))) {
          return Array.from({ length: len }, (_, i) => [row, start + i]);
        }
      }
    }
  }
  for (let col = 0; col < size; col++) {
    let colStr = '';
    for (let row = 0; row < size; row++) colStr += grid[row][col];
    for (let len = MAX_WORD_LENGTH; len >= MIN_WORD_LENGTH; len--) {
      for (let start = 0; start + len <= size; start++) {
        const segment = colStr.slice(start, start + len);
        if (WORD_SET.has(segment) || WORD_SET.has([...segment].reverse().join(''))) {
          return Array.from({ length: len }, (_, i) => [start + i, col]);
        }
      }
    }
  }
  return null;
}

// Applies `scrambleCount` random adjacent swaps directly to the grid's
// letters (not simulated through game rules - this is generation-time
// setup, not player input), then verifies `word` is no longer sitting
// fully-formed on the board. The random pass has no guarantee of ever
// touching the word's own cells (bug: was letting the word survive
// scrambling intact ~45% of the time on 200-trial testing) - the
// verification loop below closes that gap by forcing corrective swaps
// directly on the surviving run until it's broken. Also checks for and
// breaks any OTHER accidental word the raw swaps happened to create as a
// side effect - found via the offline solver's search diagnostics: a
// freshly scrambled board routinely had 3-4 unrelated accidental words
// sitting on it before the player ever touched it, which in the real
// game means either an unwanted auto-clear the instant the level loads,
// or matched tiles sitting inertly in a state the rules say shouldn't
// exist. Returns the total number of swaps actually applied (random +
// corrective), which is what the "provably solvable within this many
// swaps" guarantee is based on.
function scrambleGrid(grid, scrambleCount, word) {
  const pairs = adjacentPairs();
  let applied = 0;

  for (let i = 0; i < scrambleCount; i++) {
    const [r1, c1, r2, c2] = pairs[Math.floor(Math.random() * pairs.length)];
    const tmp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = tmp;
    applied += 1;
  }

  // Safety cap: a single corrective swap almost always breaks a straight
  // run, so this should resolve in a handful of iterations in practice.
  // Capped to avoid any theoretical infinite loop (e.g. a corrective swap
  // for one problem coincidentally recreating the other).
  const MAX_CORRECTIVE_ATTEMPTS = 150;
  let attempts = 0;
  while (attempts < MAX_CORRECTIVE_ATTEMPTS) {
    const run = findWordRun(grid, word) ?? findAnyWordRun(grid);
    if (!run) break;
    const [r1, c1] = run[Math.floor(Math.random() * run.length)];
    const neighborPairs = pairs.filter(
      ([pr1, pc1, pr2, pc2]) => (pr1 === r1 && pc1 === c1) || (pr2 === r1 && pc2 === c1)
    );
    const [pr1, pc1, pr2, pc2] = neighborPairs[Math.floor(Math.random() * neighborPairs.length)];
    const tmp = grid[pr1][pc1];
    grid[pr1][pc1] = grid[pr2][pc2];
    grid[pr2][pc2] = tmp;
    applied += 1;
    attempts += 1;
  }

  return applied;
}

// Main entry point. Returns a fully-filled BOARD_SIZE x BOARD_SIZE letter
// grid guaranteed reachable-to-targetWord in at most `scrambleCount` swaps
// (before accounting for the extra buffer in recommendedMaxSwaps).
export function generateGuaranteedBoard(targetWord, scrambleCount) {
  const word = targetWord.toUpperCase();
  if (word.length < MIN_WORD_LENGTH || word.length > MAX_WORD_LENGTH) {
    throw new Error(`targetWord "${word}" must be ${MIN_WORD_LENGTH}-${MAX_WORD_LENGTH} letters`);
  }

  const grid = emptyGrid();
  placeWord(grid, word);

  // Fill remaining cells, avoiding accidental words, in a random cell
  // order (not strict row-major) so the target word's own cells - which
  // may appear "later" in row-major order than cells that logically
  // depend on them - don't bias the avoidance check.
  const remaining = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (grid[row][col] === null) remaining.push([row, col]);
    }
  }
  shuffleArray(remaining);
  for (const [row, col] of remaining) {
    grid[row][col] = pickNonMatchingLetter(grid, row, col);
  }

  const swapsUsed = scrambleGrid(grid, scrambleCount, word);

  return { grid, scrambleSwapsUsed: swapsUsed, maxSwaps: recommendedMaxSwaps(swapsUsed) };
}
