// Prototype config: 5x5 board, swap -> match 3-5 letter word -> clear -> fall -> score.
// No target words, no special tiles, no obstacles yet (those are Phase 2/3).
//
// Was 6x6 / 3-6 letters. Dropped to 5x5 / 3-5 per chat: screen width is
// fixed at 516px regardless of column count (BOARD_PIXEL_SIZE.width below),
// so fewer columns puts more of that fixed width into each tile - a real
// ceiling raise, not another per-world fill-percentage guess. Simulated
// against two frames of different measured safe-zone size (Candy Garden,
// Magic Mountain) before committing: both come out ~21-23% bigger per tile
// at the same edge-to-edge fill they already have today. See worldFrames.js
// for the resulting per-world tileSize/tileGap/tileFontSize recalculation.
import Phaser from 'phaser';

export const BOARD_SIZE = 5;
export const MIN_WORD_LENGTH = 3;
export const MAX_WORD_LENGTH = 5;
export const TILE_SIZE = 72;
export const TILE_GAP = 6;
export const BOARD_TOP_MARGIN = 132; // room for title/subtitle/current-word/score UI above the grid
export const BOARD_SIDE_MARGIN = 24;

// Width is intentionally NOT derived from BOARD_SIZE below. This used to be
// BOARD_SIZE * (TILE_SIZE + TILE_GAP) + margins - fine back when the grid
// was always 6 columns, but getCanvasSize() (main.js) uses this width as
// the WHOLE APP's canvas width (every scene, not just BoardScene). Letting
// it shrink/grow with the grid's column count would resize every menu
// screen every time the grid changes - not what the grid change is for.
// Hardcoded at the same 516px the app has always used (still a good
// tap-target width on a phone); BoardScene's own HUD layout (pills, score
// text, word-wrap) reads this same constant and is meant to fill the real
// canvas width regardless of how many grid columns sit inside it.
const CANVAS_WIDTH = 516;

export const BOARD_PIXEL_SIZE = {
  width: CANVAS_WIDTH,
  height: BOARD_SIZE * (TILE_SIZE + TILE_GAP) + BOARD_TOP_MARGIN + BOARD_SIDE_MARGIN,
};

// The actual Phaser canvas resolution used by main.js - deliberately
// NOT the same as BOARD_PIXEL_SIZE. BOARD_PIXEL_SIZE.height is "how big
// the grid + its header naturally is" (width is now a fixed constant,
// see above); using the height as-is for the whole canvas made every
// screen (menus included) get boxed into a stubby
// 516x624 window and letterboxed top/bottom on real phones, which are
// much taller and narrower than that.
//
// Every other scene (MainMenu, HomeHub, WorldSelect, LevelPath,
// Settings, Splash) already lays itself out proportionally from
// `this.scale.width/height` (or scrolls via camera bounds), so they
// stretch correctly to whatever canvas size we give them. Only
// BoardScene assumed canvas === BOARD_PIXEL_SIZE for its full-screen
// dim overlay - that's fixed separately in BoardScene.js to use the
// real canvas size instead.
//
// getCanvasSize() (per chat) replaces what used to be a static
// CANVAS_SIZE computed once from a hardcoded 19.5:9 guess. Phaser's
// Scale.FIT preserves the canvas's exact aspect ratio and never crops
// it, so any mismatch between that hardcoded guess and the device's
// real screen ratio left a strip of the fallback background color
// showing top/bottom (or left/right) - not a rendering bug, just FIT
// doing exactly what it's told with the wrong target ratio. Real phone
// ratios vary a lot (18:9 up to ~20.5:9 and beyond on some
// foldables/tablets), so this now reads the actual window at boot and
// matches it, clamped to a sane range:
//   - floor of 1.7 (~17:10): comfortably above the 624px
//     (BOARD_PIXEL_SIZE.height) the board actually needs at this
//     516px width, so the board never gets starved for room even on
//     an unusually short/wide window (e.g. a tablet or a resized
//     desktop browser).
//   - ceiling of 2.6 (~26:10): covers every mainstream phone (most
//     land around 19.5:9-20.5:9 ≈ 2.17-2.28) with headroom for
//     outlier tall-screen devices, without letting a genuinely
//     extreme window (e.g. a very short landscape strip) stretch the
//     canvas into something unreasonable.
// 516 wide stays fixed either way (unchanged - CANVAS_WIDTH above is a
// good tap-target width on a phone regardless of grid column count);
// only the height adapts.
const MIN_HEIGHT_RATIO = 1.7;
const MAX_HEIGHT_RATIO = 2.6;

export function getCanvasSize() {
  const width = BOARD_PIXEL_SIZE.width;

  // window.innerWidth/innerHeight reflect the real on-screen viewport
  // (the Capacitor WebView is already fullscreen/immersive per
  // MainActivity.java, so there's no browser chrome to account for
  // here). Fall back to the old hardcoded 19.5:9 guess if either is
  // unavailable for some reason (e.g. this ever runs somewhere
  // without a window), rather than dividing by zero.
  const hasWindow = typeof window !== 'undefined' && window.innerWidth > 0 && window.innerHeight > 0;
  const deviceRatio = hasWindow ? window.innerHeight / window.innerWidth : 19.5 / 9;
  const ratio = Phaser.Math.Clamp(deviceRatio, MIN_HEIGHT_RATIO, MAX_HEIGHT_RATIO);

  return {
    width,
    height: Math.round(width * ratio),
  };
}

// Single source of truth for the app's dark fallback/background color -
// shows through wherever a scene's own art doesn't reach (letterbox
// edges, HUD chrome bars, transition fades). Was 0x241a3d (a purple)
// picked to match an earlier splash rebrand; per chat, switched to a
// dark forest tone since the purple looked like an obvious mistake
// wherever it peeked through the actual forest/nature art (most
// visibly as a gap above the Main Menu poster - see update.md). Three
// forms since call sites need different shapes: Phaser fill colors and
// main.js's config want a 0xRRGGBB number, CSS wants a #rrggbb string,
// and Camera.fadeOut() wants separate r/g/b integers.
//
// Kept separate from LETTERBOX_BG_COLOR below - this one is still
// used for the HUD bars in SettingsScene/WorldSelectScene/
// LevelPathScene, which need something dark for their white/gold text
// to read against. Recoloring it to something light (per chat, for
// the letterbox below) would break that contrast everywhere else it's
// used, so the letterbox got its own dedicated color instead of
// reusing this one.
export const APP_BG_COLOR = 0x17241b;
export const APP_BG_COLOR_HEX = '#17241b';
export const APP_BG_COLOR_RGB = [0x17, 0x24, 0x1b];

// Fill for the outer letterbox strip that getCanvasSize()'s aspect-
// ratio clamp can still leave on a genuinely extreme device (or while
// running an old build that predates that fix) - this is the color of
// the Phaser canvas's own backgroundColor (main.js) and the
// surrounding HTML page (index.html's body/#game-frame), which sit
// directly adjacent to each other and must always match exactly or
// the seam between them would be visible. Per chat: a light creamy
// brown/parchment tone reads as an intentional warm border around the
// art instead of an obvious mismatched color peeking through, the way
// the old purple and then dark green both did.
export const LETTERBOX_BG_COLOR = 0xe8d3a8;
export const LETTERBOX_BG_HEX = '#e8d3a8';

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Full-alphabet pool, weighted by standard English/Scrabble-style letter
// frequency so common letters (vowels, R/S/T/N/L) still come up often
// enough to form 3-5 letter words, while rare ones (Q/X/Z/J/K) show up
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
