// Phase 1 prototype config: 7x7 board, swap -> match 3 -> clear -> fall -> score.
// No target words, no special tiles, no obstacles yet (those are Phase 2/3).

export const BOARD_SIZE = 6;
export const MIN_WORD_LENGTH = 3;
export const MAX_WORD_LENGTH = 6;
export const TILE_SIZE = 72;
export const TILE_GAP = 6;
export const BOARD_TOP_MARGIN = 132; // room for title/subtitle/current-word/score UI above the grid
export const BOARD_SIDE_MARGIN = 24;

export const BOARD_PIXEL_SIZE = {
  width: BOARD_SIZE * (TILE_SIZE + TILE_GAP) + BOARD_SIDE_MARGIN * 2,
  height: BOARD_SIZE * (TILE_SIZE + TILE_GAP) + BOARD_TOP_MARGIN + BOARD_SIDE_MARGIN,
};

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Full-alphabet pool, weighted by standard English/Scrabble-style letter
// frequency so common letters (vowels, R/S/T/N/L) still come up often
// enough to form 3-6 letter words, while rare ones (Q/X/Z/J/K) show up
// only occasionally - present, but not so often they choke word density.
// NOTE: this is the full A-Z pool for now. Splitting it into progressive
// stages (e.g. Stage 1 = vowels + common consonants, later stages unlock
// the rest) is a separate follow-up once the full alphabet itself is in
// and playtested.
const LETTER_FREQUENCY = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1,
  K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6,
  U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
};

export const LETTER_POOL = ALPHABET.flatMap((letter) =>
  Array(LETTER_FREQUENCY[letter]).fill(letter)
);

// One accent colour per letter so tiles are readable at a glance even
// before art passes in Phase 5. Generated as evenly-spaced hues around
// the colour wheel (kept flat/bright/saturated for a "candy" feel) so
// every one of the 26 letters gets its own distinct colour automatically
// - hand-picking 26 non-clashing hex codes isn't worth doing by eye.
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return parseInt(`${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`, 16);
}

export const LETTER_COLORS = Object.fromEntries(
  ALPHABET.map((letter, i) => [letter, hslToHex((i * 360) / ALPHABET.length, 72, 62)])
);

export function randomLetter() {
  return LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)];
}
