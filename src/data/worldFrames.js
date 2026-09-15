// Per-world board frame art (PLAN.md §2 "per-world visual theming").
// Generalizes the Candy Garden trial (see update.md Milestone 43) into a
// data table instead of a one-off `isCandyGarden` special case in
// BoardScene.js, so adding a world's frame is "measure it, add a row"
// rather than editing scene logic each time.
//
// How each row's tileSize/tileGap/tileFontSize were derived (same method
// for all of them, including Candy Garden's pre-existing values):
// 1. The frame art's "safe zone" - the contiguous open interior clear of
//    corner ornaments/border decoration - was measured directly off the
//    source PNG's pixels (visually, with a coordinate grid overlaid on
//    the image - NOT guessed/estimated, since a guessed number is
//    exactly what caused Candy Garden's original wrong-58.5% bug).
// 2. That safe-zone box was scaled to `frameDisplaySize` (the square
//    size the frame image is displayed at in-game via setDisplaySize).
//    All source art here is a square PNG, so this scale is uniform in
//    both directions - no x/y stretch to account for (Candy Garden's
//    own frame is the one exception: its source PNG is 700x660, not
//    square, so its numbers below bake in that non-uniform stretch -
//    see the old inline comment history in BoardScene.js/git log for
//    that derivation).
// 3. The 6x6 tile grid was sized to ~90% of whichever axis (width or
//    height) of that displayed safe zone is tighter, leaving a buffer
//    on both sides so tiles don't touch corner decorations. Candy
//    Garden itself was pushed further (~92-97%) through live in-editor
//    trial and error the person did outside a Claude session; the 90%
//    figure here is a deliberately more conservative starting point
//    for frames nobody has eyeballed live in the game yet - safe to
//    nudge closer to 100% per-world later the same way Candy Garden
//    was, once someone's looked at it running on a device.
// 4. tileFontSize follows Candy Garden's own ratio (~0.42 x tileSize),
//    rounded.
//
// `frameKey`/`framePath` follow the same texture-key convention as
// worlds.js's thumbKey/bgKey (Phaser image key + its assets/ path).
//
// Worlds with no entry here (5 Cloud Kingdom, 7 Magic Mountain, 8 Space
// Words, 10 WordSwoop Kingdom) still render with the plain default
// tile look (TILE_SIZE/TILE_GAP from config.js, no frame art) until
// they get one - see update.md for why those four are still open.

export const WORLD_FRAMES = {
  1: {
    frameKey: 'frame-candy-garden',
    framePath: 'assets/frame-candy-garden.png',
    frameDisplaySize: 505,
    tileSize: 52,
    tileGap: 5,
    tileFontSize: 22,
  },
  2: {
    frameKey: 'frame-jungle-jumble',
    framePath: 'assets/frame-jungle-jumble.png',
    frameDisplaySize: 505,
    tileSize: 41,
    tileGap: 5,
    tileFontSize: 17,
  },
  3: {
    frameKey: 'frame-ocean-words',
    framePath: 'assets/frame-ocean-words.png',
    frameDisplaySize: 505,
    tileSize: 41,
    tileGap: 5,
    tileFontSize: 17,
  },
  4: {
    frameKey: 'frame-dino-valley',
    framePath: 'assets/frame-dino-valley.png',
    frameDisplaySize: 505,
    tileSize: 42,
    tileGap: 5,
    tileFontSize: 18,
  },
  6: {
    frameKey: 'frame-crystal-forest',
    framePath: 'assets/frame-crystal-forest.png',
    frameDisplaySize: 505,
    tileSize: 49,
    tileGap: 5,
    tileFontSize: 21,
  },
  9: {
    frameKey: 'frame-ancient-valley',
    framePath: 'assets/frame-ancient-valley.png',
    frameDisplaySize: 505,
    tileSize: 36,
    tileGap: 5,
    tileFontSize: 15,
  },
};

export function getWorldFrame(worldId) {
  return WORLD_FRAMES[worldId] ?? null;
}
