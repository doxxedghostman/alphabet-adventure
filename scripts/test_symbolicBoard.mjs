import {
  findWordMatchesSymbolic,
  trySwapSymbolic,
  targetWordPresentSymbolic,
  POISONED,
} from './symbolicBoard.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`ok: ${msg}`);
}

// Filler letters chosen to be very unlikely to accidentally spell
// anything in the safe zones below - verified by the zero-matches
// assertion right after building each grid.
const F = 'Q';

// ---------- Test 1: direct swap completes a word ----------
// row0 = C,T,A,F,F,F ("CTA" isn't a word) -> swapping (0,1)-(0,2) gives
// C,A,T,... = "CAT"
{
  const grid = [
    ['C', 'T', 'A', F, F, F],
    [F, F, F, F, F, F],
    [F, F, F, F, F, F],
    [F, F, F, F, F, F],
    [F, F, F, F, F, F],
    [F, F, F, F, F, F],
  ];
  const pre = findWordMatchesSymbolic(grid);
  assert(pre.matchedCells.size === 0, 'test 1 setup: no accidental matches before the swap');

  const result = trySwapSymbolic(grid, 0, 1, 0, 2);
  assert(result !== null, 'test 1: direct swap that completes CAT is legal');
  assert(result.wordsFound.includes('CAT'), 'test 1: CAT is reported as found');
  assert(targetWordPresentSymbolic(grid, 'CAT') === false, 'test 1: original grid is untouched (no mutation)');
}

// ---------- Test 2: pass-through relocation ----------
// col0 = D,B,G,F,F,F ; row1 = B,O,F,F,F,F (B is the shared cell at (1,0))
// Swapping (1,0)<->(1,1) [B<->O] makes col0 read D,O,G = "DOG", which
// does NOT include (1,1) (B's new position) - B should survive, known,
// at (1,1), while col0's matched cells get poisoned.
{
  const grid = [
    ['D', F, F, F, F, F],
    ['B', 'O', F, F, F, F],
    ['G', F, F, F, F, F],
    [F, F, F, F, F, F],
    [F, F, F, F, F, F],
    [F, F, F, F, F, F],
  ];
  const pre = findWordMatchesSymbolic(grid);
  assert(pre.matchedCells.size === 0, 'test 2 setup: no accidental matches before the swap');

  const result = trySwapSymbolic(grid, 1, 0, 1, 1);
  assert(result !== null, 'test 2: pass-through swap is legal');
  assert(result.wordsFound.includes('DOG'), 'test 2: DOG is reported as found');
  assert(result.grid[1][1] === 'B', 'test 2: B survived, relocated to (1,1), and is KNOWN not poisoned');
  assert(result.grid[0][0] === POISONED, 'test 2: (0,0) [part of the DOG match] is poisoned');
  assert(result.grid[1][0] === POISONED || result.grid[1][0] !== 'B', 'test 2: B did not stay at (1,0)');
}

// ---------- Test 3: illegal swap bounces back (returns null) ----------
{
  const grid = [
    [F, F, F, F, F, F],
    [F, F, F, F, F, F],
    [F, F, F, F, F, F],
    [F, F, F, F, F, F],
    [F, F, F, F, F, F],
    [F, F, F, F, F, F],
  ];
  const result = trySwapSymbolic(grid, 3, 3, 3, 4);
  assert(result === null, 'test 3: swap forming no word is illegal (bounces back)');
}

// ---------- Test 4: swap touching a poisoned cell is refused ----------
{
  const grid = [
    [POISONED, 'X', F, F, F, F],
    [F, F, F, F, F, F],
    [F, F, F, F, F, F],
    [F, F, F, F, F, F],
    [F, F, F, F, F, F],
    [F, F, F, F, F, F],
  ];
  const result = trySwapSymbolic(grid, 0, 0, 0, 1);
  assert(result === null, 'test 4: swap involving a POISONED cell is always refused, regardless of outcome');
}

console.log('\nAll symbolic board smoke tests passed.');
