// Node coordinates for LevelPathScene, in the background image's own
// pixel space (see each world's `pathSpace` in worlds.js) so they
// scale automatically with however the scene displays that image.
// 20 nodes per world, node 1 at the bottom (Start), node 20 at the
// top (boss) — path reads bottom-to-top per PLAN.md §8.5.
//
// Candy Garden's points below are the pixel centers of the medal
// badges already baked into public/assets/candy-garden-bg.jpg
// (1024x1536 — per chat, this replaced the old code-drawn-path art)
// found by color-thresholding the art for the badges' pink/gold fill
// and taking each blob's centroid, then ordered bottom-to-top by that
// position — NOT by the number printed on each medal. The art's own
// printed numbers actually skip 6 and 14 and repeat 13 and 18 (an art
// generation slip), so they can't be trusted for ordering; position
// order is what actually drives level unlock/select here, same as
// before. Worth a fixed re-gen of the art if the mislabeled medals
// bother us visually, but it's cosmetic only — doesn't affect play.
const CANDY_GARDEN_PATH = [
  { x: 329, y: 1340 }, // 1: Start, bottom of the path
  { x: 721, y: 1171 },
  { x: 436, y: 1166 },
  { x: 436, y: 1032 },
  { x: 699, y: 1022 },
  { x: 689, y: 889 },
  { x: 349, y: 854 },
  { x: 590, y: 771 },
  { x: 319, y: 752 },
  { x: 447, y: 652 },
  { x: 681, y: 599 },
  { x: 736, y: 502 },
  { x: 495, y: 475 },
  { x: 660, y: 399 },
  { x: 423, y: 390 },
  { x: 748, y: 317 },
  { x: 536, y: 311 },
  { x: 450, y: 250 },
  { x: 654, y: 240 },
  { x: 555, y: 175 }, // 20: boss node, gold medal at the castle gate
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
