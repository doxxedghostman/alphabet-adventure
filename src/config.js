// Phase 1 prototype config: 7x7 board, swap -> match 3 -> clear -> fall -> score.
// No target words, no special tiles, no obstacles yet (those are Phase 2/3).

export const BOARD_SIZE = 7;
export const TILE_SIZE = 72;
export const TILE_GAP = 6;
export const BOARD_TOP_MARGIN = 90; // room for score/title UI above the grid
export const BOARD_SIDE_MARGIN = 24;

export const BOARD_PIXEL_SIZE = {
  width: BOARD_SIZE * (TILE_SIZE + TILE_GAP) + BOARD_SIDE_MARGIN * 2,
  height: BOARD_SIZE * (TILE_SIZE + TILE_GAP) + BOARD_TOP_MARGIN + BOARD_SIDE_MARGIN,
};

// Vowel-heavy, common-consonant pool so 3-in-a-row matches (and eventually
// short words) are easy to form. Weighted by repetition rather than a
// separate weights table, so it stays easy to tune by eye.
export const LETTER_POOL = [
  'A', 'A', 'A', 'E', 'E', 'E', 'I', 'I', 'O', 'O', 'U',
  'R', 'R', 'S', 'S', 'T', 'T', 'L', 'L', 'N', 'N',
];

// One accent colour per letter so tiles are readable at a glance even
// before art passes in Phase 5. Kept flat/bright for a "candy" feel.
export const LETTER_COLORS = {
  A: 0xff6b6b,
  E: 0xffd93d,
  I: 0x6bc9ef,
  O: 0x4ecdc4,
  U: 0xa78bfa,
  R: 0xff9f43,
  S: 0x54a0ff,
  T: 0x1dd1a1,
  L: 0xf368e0,
  N: 0xfeca57,
};

export function randomLetter() {
  return LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)];
}
