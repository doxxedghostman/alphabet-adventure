// Node coordinates for LevelPathScene's winding path, in the
// background image's own pixel space (600x900 — see worlds.js's
// bgPath) so they scale automatically with however the scene displays
// that image. 20 nodes per world, node 1 at the bottom (Start), node
// 20 at the top (boss) — path reads bottom-to-top per PLAN.md §8.5.
//
// Candy Garden's points below are hand-placed by eye against the
// actual background art (public/assets/candy-garden-bg.jpg) to
// roughly track its painted path. This is a first pass, not a pixel-
// perfect trace — the art's curves are organic and hand-tuning exact
// node-to-path alignment is a polish pass worth doing visually in the
// game itself, not blind from here.
//
// Other worlds don't have hand-placed points yet (their LevelPathScene
// isn't reachable yet anyway — only World 1 is unlocked at the start)
// so CANDY_GARDEN_PATH is the only real entry; everything else falls
// back to a generic serpentine via generateSerpentinePath(). Repeat
// the hand-placement process per world as each one's content gets
// built (see PLAN.md §8.5's build order).

const CANDY_GARDEN_PATH = [
  { x: 300, y: 855 }, // 1: Start signpost, bottom of the path
  { x: 200, y: 815 },
  { x: 160, y: 745 },
  { x: 215, y: 685 },
  { x: 300, y: 660 },
  { x: 375, y: 615 },
  { x: 340, y: 555 },
  { x: 255, y: 535 },
  { x: 195, y: 490 },
  { x: 245, y: 440 },
  { x: 330, y: 425 },
  { x: 390, y: 385 },
  { x: 355, y: 335 },
  { x: 270, y: 315 },
  { x: 225, y: 265 },
  { x: 280, y: 225 },
  { x: 355, y: 210 },
  { x: 385, y: 175 },
  { x: 350, y: 150 },
  { x: 385, y: 130 }, // 20: boss node, at the castle gate
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
