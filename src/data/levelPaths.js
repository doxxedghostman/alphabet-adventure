// Node coordinates for LevelPathScene, in the background image's own
// pixel space (see each world's `pathSpace` in worlds.js) so they
// scale automatically with however the scene displays that image.
// 20 nodes per world, node 1 at the bottom (Start), node 20 at the
// top (boss) — path reads bottom-to-top per PLAN.md §8.5.
//
// Per chat: Candy Garden went through a "baked-in numbered medals"
// art experiment and back - see git history around
// c0ea4c4/3418edc if that's ever worth resurrecting. We're back to
// the original plain scenery art (public/assets/candy-garden-bg.jpg)
// with these nodes as code-drawn circles/lock icons (see
// LevelPathScene.js's createCodeDrawnPath), which is what lets the
// scene show the FULL image edge-to-edge with no side cropping - it
// scales to the canvas width only and scrolls vertically, rather than
// "cover" scaling (which crops left/right) like the medal-art
// approach used.
//
// The original 600x900 art was too short for that width-only scaling
// on tall phones though - once scaled to the 516-wide canvas it
// mapped to well under the ~1342px a maxed-out-tall device's viewport
// needs, leaving a flat-color gap below it (the "half the screen is
// empty tan" bug from the first screenshot in this thread). Fixed by
// vertically extending that same art (mirror-tiling its lower,
// castle-free scenery band down to 600x1700 - comfortably taller than
// any supported device viewport) rather than cropping or stretching
// anything - see the extension script in chat history if regenerating.
//
// These 20 points are an evenly-spaced sine-wave serpentine over that
// new 600x1700 canvas (not hand-placed) specifically so the nodes
// have generous, consistent spacing top-to-bottom - per chat, the old
// hand-placed points felt cramped. Retune amplitude/bends here if the
// zigzag needs to hug the art's actual dirt path more closely once
// real icon-button art replaces the plain circles.
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

// Fallback for worlds without hand-placed points yet: an evenly-spaced
// sine-wave serpentine from bottom to top over the same 600x900 space,
// so every world's LevelPathScene is at least navigable before its
// real path gets hand-tuned.
function generateSerpentinePath() {
  const nodeCount = 20;
  const topY = 130;
  const bottomY = 855;
  const centerX = 300;
  const amplitude = 100;
  const bends = 3.5; // how many full left-right swings top-to-bottom

  return Array.from({ length: nodeCount }, (_, i) => {
    const t = i / (nodeCount - 1);
    const y = bottomY - t * (bottomY - topY);
    const x = centerX + Math.sin(t * bends * Math.PI) * amplitude;
    return { x, y };
  });
}

const GENERIC_PATH = generateSerpentinePath();

export function getPathNodes(worldId) {
  if (worldId === 1) return CANDY_GARDEN_PATH;
  return GENERIC_PATH;
}
