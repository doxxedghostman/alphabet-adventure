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

// Candy Garden - tight zigzag matching its narrow winding dirt path.
const CANDY_GARDEN_PATH = [
  { x: 300, y: 1650 }, // 1: Start, bottom of the path
  { x: 396, y: 1571 },
  { x: 405, y: 1492 },
  { x: 319, y: 1413 },
  { x: 215, y: 1334 },
  { x: 189, y: 1255 },
  { x: 263, y: 1176 },
  { x: 371, y: 1097 },
  { x: 415, y: 1018 },
  { x: 355, y: 939 },
  { x: 245, y: 861 },
  { x: 185, y: 782 },
  { x: 229, y: 703 },
  { x: 337, y: 624 },
  { x: 411, y: 545 },
  { x: 385, y: 466 },
  { x: 281, y: 387 },
  { x: 195, y: 308 },
  { x: 204, y: 229 },
  { x: 300, y: 150 }, // 20: boss node, on the castle courtyard steps
];

// Jungle Jumble - fairly straight jungle trail, mild wobble.
const JUNGLE_JUMBLE_PATH = [
  { x: 300, y: 1650 }, // 1: Start
  { x: 323, y: 1572 },
  { x: 343, y: 1494 },
  { x: 359, y: 1416 },
  { x: 368, y: 1338 },
  { x: 370, y: 1261 },
  { x: 364, y: 1183 },
  { x: 352, y: 1105 },
  { x: 333, y: 1027 },
  { x: 312, y: 949 },
  { x: 288, y: 871 },
  { x: 267, y: 793 },
  { x: 248, y: 715 },
  { x: 236, y: 637 },
  { x: 230, y: 559 },
  { x: 232, y: 482 },
  { x: 241, y: 404 },
  { x: 257, y: 326 },
  { x: 277, y: 248 },
  { x: 300, y: 170 }, // 20: boss node, near the temple bridge
];

// Ocean Words - sandy sea-floor path curving toward the shipwreck.
const OCEAN_WORDS_PATH = [
  { x: 310, y: 1650 }, // 1: Start
  { x: 346, y: 1573 },
  { x: 376, y: 1495 },
  { x: 395, y: 1418 },
  { x: 400, y: 1341 },
  { x: 389, y: 1263 },
  { x: 365, y: 1186 },
  { x: 332, y: 1108 },
  { x: 295, y: 1031 },
  { x: 261, y: 954 },
  { x: 235, y: 876 },
  { x: 221, y: 799 },
  { x: 223, y: 722 },
  { x: 239, y: 644 },
  { x: 267, y: 567 },
  { x: 303, y: 489 },
  { x: 339, y: 412 },
  { x: 371, y: 335 },
  { x: 392, y: 257 },
  { x: 400, y: 180 }, // 20: boss node, at the shipwreck
];

// Dino Valley - riverside trail toward the volcano/dino skyline.
const DINO_VALLEY_PATH = [
  { x: 300, y: 1650 }, // 1: Start
  { x: 323, y: 1573 },
  { x: 343, y: 1495 },
  { x: 359, y: 1418 },
  { x: 368, y: 1341 },
  { x: 370, y: 1263 },
  { x: 364, y: 1186 },
  { x: 352, y: 1108 },
  { x: 333, y: 1031 },
  { x: 312, y: 954 },
  { x: 288, y: 876 },
  { x: 267, y: 799 },
  { x: 248, y: 722 },
  { x: 236, y: 644 },
  { x: 230, y: 567 },
  { x: 232, y: 489 },
  { x: 241, y: 412 },
  { x: 257, y: 335 },
  { x: 277, y: 257 },
  { x: 300, y: 180 }, // 20: boss node, near the volcano
];

// Cloud Kingdom - wide island-to-island sweep, gazebo to castle.
const CLOUD_KINGDOM_PATH = [
  { x: 280, y: 1650 }, // 1: Start, near the gazebo
  { x: 342, y: 1573 },
  { x: 389, y: 1495 },
  { x: 410, y: 1418 },
  { x: 399, y: 1341 },
  { x: 360, y: 1263 },
  { x: 301, y: 1186 },
  { x: 238, y: 1108 },
  { x: 184, y: 1031 },
  { x: 154, y: 954 },
  { x: 154, y: 876 },
  { x: 184, y: 799 },
  { x: 238, y: 722 },
  { x: 301, y: 644 },
  { x: 360, y: 567 },
  { x: 399, y: 489 },
  { x: 410, y: 412 },
  { x: 389, y: 335 },
  { x: 342, y: 257 },
  { x: 280, y: 180 }, // 20: boss node, at the castle
];

// Crystal Forest - gentle trail past the glowing crystal grove.
const CRYSTAL_FOREST_PATH = [
  { x: 300, y: 1650 }, // 1: Start
  { x: 323, y: 1577 },
  { x: 343, y: 1504 },
  { x: 359, y: 1431 },
  { x: 368, y: 1357 },
  { x: 370, y: 1284 },
  { x: 364, y: 1211 },
  { x: 352, y: 1138 },
  { x: 333, y: 1065 },
  { x: 312, y: 992 },
  { x: 288, y: 918 },
  { x: 267, y: 845 },
  { x: 248, y: 772 },
  { x: 236, y: 699 },
  { x: 230, y: 626 },
  { x: 232, y: 553 },
  { x: 241, y: 479 },
  { x: 257, y: 406 },
  { x: 277, y: 333 },
  { x: 300, y: 260 }, // 20: boss node, at the crystal peaks
];

// Space Words - rocky trail from the crash site up toward the robot.
const SPACE_WORDS_PATH = [
  { x: 300, y: 1650 }, // 1: Start
  { x: 323, y: 1577 },
  { x: 343, y: 1504 },
  { x: 359, y: 1431 },
  { x: 368, y: 1357 },
  { x: 370, y: 1284 },
  { x: 364, y: 1211 },
  { x: 352, y: 1138 },
  { x: 333, y: 1065 },
  { x: 312, y: 992 },
  { x: 288, y: 918 },
  { x: 267, y: 845 },
  { x: 248, y: 772 },
  { x: 236, y: 699 },
  { x: 230, y: 626 },
  { x: 232, y: 553 },
  { x: 241, y: 479 },
  { x: 257, y: 406 },
  { x: 277, y: 333 },
  { x: 300, y: 260 }, // 20: boss node, near the robot/ship
];

// Ancient Valley - desert path past the oasis toward the pyramids.
const ANCIENT_VALLEY_PATH = [
  { x: 300, y: 1650 }, // 1: Start
  { x: 323, y: 1575 },
  { x: 343, y: 1499 },
  { x: 359, y: 1424 },
  { x: 368, y: 1349 },
  { x: 370, y: 1274 },
  { x: 364, y: 1198 },
  { x: 352, y: 1123 },
  { x: 333, y: 1048 },
  { x: 312, y: 973 },
  { x: 288, y: 897 },
  { x: 267, y: 822 },
  { x: 248, y: 747 },
  { x: 236, y: 672 },
  { x: 230, y: 596 },
  { x: 232, y: 521 },
  { x: 241, y: 446 },
  { x: 257, y: 371 },
  { x: 277, y: 295 },
  { x: 300, y: 220 }, // 20: boss node, at the pyramids/sphinx
];

// Magic Mountain - single sweeping stone stairway (fewer, wider bends
// than the others, matching the actual art - see chat).
const MAGIC_MOUNTAIN_PATH = [
  { x: 300, y: 1650 }, // 1: Start, bottom of the stairway
  { x: 360, y: 1570 },
  { x: 401, y: 1490 },
  { x: 408, y: 1410 },
  { x: 381, y: 1330 },
  { x: 327, y: 1250 },
  { x: 264, y: 1170 },
  { x: 213, y: 1090 },
  { x: 190, y: 1010 },
  { x: 203, y: 930 },
  { x: 248, y: 850 },
  { x: 309, y: 770 },
  { x: 368, y: 690 },
  { x: 404, y: 610 },
  { x: 407, y: 530 },
  { x: 375, y: 450 },
  { x: 318, y: 370 },
  { x: 256, y: 290 },
  { x: 208, y: 210 },
  { x: 190, y: 130 }, // 20: boss node, at the castle gate
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
