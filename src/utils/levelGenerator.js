// Target boards start one legal swap away from the requested word. A longer
// reverse-scramble path is not a guarantee: non-scoring swaps bounce back,
// while scoring swaps clear and refill cells with random letters.
import { BOARD_SIZE, MIN_WORD_LENGTH, MAX_WORD_LENGTH, randomLetter } from '../config.js';
import { WORD_SET } from '../data/wordlist.js';
import { lineHasWord } from './wordRules.js';

function shuffleArray(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function boardHasWord(grid) {
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (lineHasWord(grid[i]) || lineHasWord(grid.map((row) => row[i]))) return true;
  }
  return false;
}

function placeWord(grid, word) {
  const horizontal = Math.random() < 0.5;
  const line = Math.floor(Math.random() * BOARD_SIZE);
  const start = Math.floor(Math.random() * (BOARD_SIZE - word.length + 1));
  const cells = [];
  for (let i = 0; i < word.length; i++) {
    const row = horizontal ? line : start + i;
    const col = horizontal ? start + i : line;
    grid[row][col] = word[i];
    cells.push([row, col]);
  }
  return cells;
}

function adjacentOffWordCells(row, col, wordCells) {
  const occupied = new Set(wordCells.map(([r, c]) => `${r},${c}`));
  return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
    .filter(([r, c]) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && !occupied.has(`${r},${c}`));
}

// Return a match-free board and a legal swap that immediately spells the
// target. The swap is exposed for tests and future hint systems.
export function generateGuaranteedBoard(targetWord) {
  const word = targetWord.toUpperCase();
  if (word.length < MIN_WORD_LENGTH || word.length > MAX_WORD_LENGTH || !WORD_SET.has(word)) {
    throw new Error(`Invalid target word: ${targetWord}`);
  }

  for (let attempt = 0; attempt < 500; attempt++) {
    const grid = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    const wordCells = placeWord(grid, word);
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (grid[row][col] === null) grid[row][col] = randomLetter();
      }
    }

    for (const [row, col] of shuffleArray([...wordCells])) {
      for (const [otherRow, otherCol] of shuffleArray(adjacentOffWordCells(row, col, wordCells))) {
        if (grid[row][col] === grid[otherRow][otherCol]) continue;
        [grid[row][col], grid[otherRow][otherCol]] = [grid[otherRow][otherCol], grid[row][col]];
        if (!boardHasWord(grid)) {
          return { grid, solutionSwap: [row, col, otherRow, otherCol] };
        }
        [grid[row][col], grid[otherRow][otherCol]] = [grid[otherRow][otherCol], grid[row][col]];
      }
    }
  }
  throw new Error(`Could not generate a playable board for ${word}`);
}
