// Node coordinates for LevelPathScene, in the background image's own
// pixel space (see each world's `pathSpace` in worlds.js) so they
// scale automatically with however the scene displays that image.
// 20 nodes per world, node 1 at the bottom (Start), node 20 at the
// top (boss) — path reads bottom-to-top per PLAN.md §8.5.
//
// Per chat: Candy Garden went through a "baked-in numbered medals"
// art experiment and back - see git history around c0ea4c4/3418edc
// if that's ever worth resurrecting. Every world is now back to (or
// started as) plain scenery art with these nodes as code-drawn icons
// (see LevelPathScene.js), which is what lets the scene show the FULL
// image edge-to-edge with no side cropping - it scales to the canvas
// width only and scrolls vertically, rather than "cover" scaling
// (which crops left/right).
//
// Every world's original 600x900 art was too short for that
// width-only scaling on tall phones though - once scaled to the
// 516-wide canvas it mapped to well under the ~1342px a maxed-out-tall
// device's viewport needs, leaving a flat-color gap below it (the
// "half the screen is empty tan" bug from the first Candy Garden
// screenshot in this thread). Fixed the same way for all 10 worlds:
// vertically extending each world's own art (mirror-tiling a generic,
// landmark-free band of its own scenery - a different band per world,
// picked by eye to avoid duplicating each one's unique castle/statue/
// shipwreck/etc.) down to 600x1700 - comfortably taller than any
// supported device viewport.
//
// Each world's 20 points below are an evenly-spaced sine-wave
// serpentine over that world's own 600x1700 canvas (not hand-placed),
// with centerX/amplitude/bends per world eyeballed against that
// world's actual path shape (tight zigzag vs. wide sweeping S-curve
// vs. switchback) so nodes track it reasonably closely - see the
// per-world comments below. Retune any of these if the zigzag needs
// to hug the art's actual path more closely.

// Candy Garden - color-traced, arc-length-spaced nodes on continuous 600x1700 art.
const CANDY_GARDEN_PATH = [
  { x: 263, y: 1542 }, // 1: Start, bottom of the path
  { x: 356, y: 1483 },
  { x: 332, y: 1384 },
  { x: 253, y: 1309 },
  { x: 311, y: 1228 },
  { x: 403, y: 1175 },
  { x: 460, y: 1095 },
  { x: 385, y: 1019 },
  { x: 338, y: 928 },
  { x: 273, y: 838 },
  { x: 315, y: 745 },
  { x: 405, y: 681 },
  { x: 372, y: 588 },
  { x: 279, y: 533 },
  { x: 336, y: 455 },
  { x: 422, y: 397 },
  { x: 336, y: 339 },
  { x: 350, y: 269 },
  { x: 430, y: 204 },
  { x: 401, y: 130 }, // 20: boss
];

// Jungle Jumble - fairly straight jungle trail, mild wobble.
const JUNGLE_JUMBLE_PATH = [
  { x: 294, y: 1678 }, // 1: Start, bottom of the path
  { x: 303, y: 1584 },
  { x: 217, y: 1532 },
  { x: 263, y: 1456 },
  { x: 329, y: 1382 },
  { x: 318, y: 1303 },
  { x: 273, y: 1234 },
  { x: 313, y: 1149 },
  { x: 387, y: 1091 },
  { x: 369, y: 1001 },
  { x: 306, y: 934 },
  { x: 264, y: 857 },
  { x: 311, y: 788 },
  { x: 371, y: 714 },
  { x: 313, y: 644 },
  { x: 264, y: 569 },
  { x: 349, y: 519 },
  { x: 288, y: 458 },
  { x: 214, y: 396 },
  { x: 266, y: 348 }, // 20: boss
];

// Ocean Words - sandy sea-floor path curving toward the shipwreck.
const OCEAN_WORDS_PATH = [
  { x: 328, y: 1671 }, // 1: Start, bottom of the path
  { x: 325, y: 1568 },
  { x: 355, y: 1479 },
  { x: 339, y: 1383 },
  { x: 276, y: 1311 },
  { x: 255, y: 1233 },
  { x: 254, y: 1156 },
  { x: 319, y: 1085 },
  { x: 391, y: 1022 },
  { x: 339, y: 941 },
  { x: 261, y: 887 },
  { x: 242, y: 806 },
  { x: 310, y: 744 },
  { x: 393, y: 695 },
  { x: 400, y: 610 },
  { x: 312, y: 568 },
  { x: 258, y: 502 },
  { x: 337, y: 447 },
  { x: 429, y: 409 },
  { x: 411, y: 340 }, // 20: boss
];

// Dino Valley - riverside trail toward the volcano/dino skyline.
const DINO_VALLEY_PATH = [
  { x: 291, y: 1601 }, // 1: Start, bottom of the path
  { x: 347, y: 1524 },
  { x: 383, y: 1431 },
  { x: 346, y: 1334 },
  { x: 274, y: 1276 },
  { x: 218, y: 1192 },
  { x: 264, y: 1108 },
  { x: 345, y: 1058 },
  { x: 424, y: 1003 },
  { x: 429, y: 911 },
  { x: 348, y: 859 },
  { x: 268, y: 800 },
  { x: 264, y: 715 },
  { x: 351, y: 665 },
  { x: 391, y: 591 },
  { x: 314, y: 531 },
  { x: 218, y: 496 },
  { x: 207, y: 427 },
  { x: 307, y: 397 },
  { x: 303, y: 343 }, // 20: boss
];

// Cloud Kingdom - wide island-to-island sweep, gazebo to castle.
const CLOUD_KINGDOM_PATH = [
  { x: 447, y: 1615 }, // 1: Start, bottom of the path
  { x: 353, y: 1547 },
  { x: 270, y: 1474 },
  { x: 279, y: 1386 },
  { x: 348, y: 1290 },
  { x: 254, y: 1222 },
  { x: 205, y: 1123 },
  { x: 301, y: 1062 },
  { x: 397, y: 991 },
  { x: 327, y: 900 },
  { x: 222, y: 845 },
  { x: 275, y: 766 },
  { x: 375, y: 708 },
  { x: 471, y: 635 },
  { x: 375, y: 570 },
  { x: 279, y: 501 },
  { x: 215, y: 416 },
  { x: 333, y: 387 },
  { x: 411, y: 311 },
  { x: 420, y: 235 }, // 20: boss
];

// Crystal Forest - gentle trail past the glowing crystal grove.
const CRYSTAL_FOREST_PATH = [
  { x: 372, y: 1616 }, // 1: Start, bottom of the path
  { x: 307, y: 1551 },
  { x: 294, y: 1464 },
  { x: 322, y: 1385 },
  { x: 372, y: 1323 },
  { x: 389, y: 1233 },
  { x: 395, y: 1147 },
  { x: 326, y: 1091 },
  { x: 268, y: 1024 },
  { x: 237, y: 951 },
  { x: 297, y: 882 },
  { x: 384, y: 847 },
  { x: 458, y: 802 },
  { x: 401, y: 738 },
  { x: 331, y: 690 },
  { x: 257, y: 639 },
  { x: 225, y: 579 },
  { x: 309, y: 538 },
  { x: 392, y: 497 },
  { x: 431, y: 422 }, // 20: boss
];

// Space Words - rocky trail from the crash site up toward the robot.
const SPACE_WORDS_PATH = [
  { x: 493, y: 1619 }, // 1: Start, bottom of the path
  { x: 406, y: 1560 },
  { x: 327, y: 1496 },
  { x: 232, y: 1440 },
  { x: 207, y: 1343 },
  { x: 274, y: 1261 },
  { x: 366, y: 1202 },
  { x: 437, y: 1123 },
  { x: 406, y: 1022 },
  { x: 317, y: 966 },
  { x: 223, y: 917 },
  { x: 231, y: 820 },
  { x: 326, y: 772 },
  { x: 413, y: 711 },
  { x: 385, y: 615 },
  { x: 293, y: 567 },
  { x: 195, y: 521 },
  { x: 201, y: 428 },
  { x: 307, y: 392 },
  { x: 369, y: 331 }, // 20: boss
];

// Ancient Valley - desert path past the oasis toward the pyramids.
const ANCIENT_VALLEY_PATH = [
  { x: 250, y: 1619 }, // 1: Start, bottom of the path
  { x: 311, y: 1555 },
  { x: 299, y: 1454 },
  { x: 352, y: 1366 },
  { x: 305, y: 1277 },
  { x: 250, y: 1189 },
  { x: 213, y: 1096 },
  { x: 298, y: 1026 },
  { x: 381, y: 966 },
  { x: 404, y: 869 },
  { x: 316, y: 817 },
  { x: 230, y: 763 },
  { x: 189, y: 669 },
  { x: 255, y: 596 },
  { x: 361, y: 567 },
  { x: 449, y: 510 },
  { x: 383, y: 437 },
  { x: 282, y: 403 },
  { x: 299, y: 331 },
  { x: 401, y: 294 }, // 20: boss
];

// Magic Mountain - single sweeping stone stairway (fewer, wider bends
// than the others, matching the actual art - see chat).
const MAGIC_MOUNTAIN_PATH = [
  { x: 293, y: 1617 }, // 1: Start, bottom of the path
  { x: 292, y: 1516 },
  { x: 321, y: 1415 },
  { x: 336, y: 1320 },
  { x: 263, y: 1251 },
  { x: 317, y: 1173 },
  { x: 364, y: 1089 },
  { x: 297, y: 1021 },
  { x: 217, y: 966 },
  { x: 264, y: 892 },
  { x: 348, y: 837 },
  { x: 315, y: 758 },
  { x: 220, y: 717 },
  { x: 228, y: 646 },
  { x: 312, y: 594 },
  { x: 367, y: 534 },
  { x: 347, y: 467 },
  { x: 438, y: 419 },
  { x: 374, y: 346 },
  { x: 429, y: 300 }, // 20: boss
];

// WordSwoop Kingdom - switchback courtyard path, fountain to castle.
const WORDSWOOP_KINGDOM_PATH = [
  { x: 300, y: 1650 }, // 1: Start, near the fountain
  { x: 348, y: 1574 },
  { x: 384, y: 1497 },
  { x: 400, y: 1421 },
  { x: 392, y: 1345 },
  { x: 361, y: 1268 },
  { x: 316, y: 1192 },
  { x: 268, y: 1116 },
  { x: 226, y: 1039 },
  { x: 203, y: 963 },
  { x: 203, y: 887 },
  { x: 226, y: 811 },
  { x: 268, y: 734 },
  { x: 316, y: 658 },
  { x: 361, y: 582 },
  { x: 392, y: 505 },
  { x: 400, y: 429 },
  { x: 384, y: 353 },
  { x: 348, y: 276 },
  { x: 300, y: 200 }, // 20: boss node, at the castle
];

const PATHS_BY_WORLD = {
  1: CANDY_GARDEN_PATH,
  2: JUNGLE_JUMBLE_PATH,
  3: OCEAN_WORDS_PATH,
  4: DINO_VALLEY_PATH,
  5: CLOUD_KINGDOM_PATH,
  6: CRYSTAL_FOREST_PATH,
  7: MAGIC_MOUNTAIN_PATH,
  8: SPACE_WORDS_PATH,
  9: ANCIENT_VALLEY_PATH,
  10: WORDSWOOP_KINGDOM_PATH,
};

export function getPathNodes(worldId) {
  return PATHS_BY_WORLD[worldId] ?? CANDY_GARDEN_PATH;
}
