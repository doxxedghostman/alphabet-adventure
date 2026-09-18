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
// Recalculated for a 5x5 grid (per chat, config.js) - each world's total
// covered footprint inside its safe zone was kept identical to its old
// 6x6 numbers (same measured fill, no re-guessing needed), just redivided
// into 5 cells instead of 6: newTileSize = round(6*(oldTile+oldGap)/5 - gap).
// That's a straight ~21-23% tile-size increase everywhere, same edge-to-
// edge coverage as before. Original derivation method below still applies
// to the underlying safe-zone measurements themselves.
//
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
// Worlds with a `bossFrameKey`/`bossFramePath`/`bossTile*` set use that
// variant instead for a world's boss level (level 20 - see
// progressStore.js's LEVELS_PER_WORLD and BoardScene.js's `isBoss`) -
// same idea as Candy Garden/Dino Valley each having 2 source frames in
// the original batch, just wired to level number instead of picked
// arbitrarily.
//
// All 10 worlds now have an entry (200/200 levels covered), but not
// all with equal confidence: worlds 1-4, 6, 9 got a frame whose art
// was actually made for that theme. Worlds 5, 7, 8, 10 use leftover
// frames from the same batch with no purpose-built match to their
// world name/theme - best-available substitutes, flagged inline below
// on each of those entries. Swap freely once better-fitting art shows
// up for those four.

// Re-measured for real (per chat: "other maps still small not like candy").
// Worlds 2-10's 5x5 numbers below were, until now, still derived from the
// OLD 6x6 numbers via a formula (see git history) that itself came from a
// generic "~90% of a guessed safe zone" placeholder - never actually
// measured per-image the way Candy Garden was. Measured all 11 remaining
// frames (9 base + 2 boss) directly off their pixels this time, same
// method as Candy Garden: grid overlay image generated per frame, safe
// interior read off by eye (left/right/top/bottom in source pixels),
// then the same target fill Candy Garden itself uses (~95% of the
// tighter axis) applied uniformly - no more leaving the other 9 worlds
// on a more conservative number "because nobody's tested them live yet".
// Biggest corrections: Dino Valley (safe zone nearly DOUBLE what the old
// formula assumed - its frame is a thin corner-decoration-only border
// with a huge open interior) and Crystal Forest (also well under-filled).
// Jungle/Ocean/Ancient/Space came out within a pixel or two of their
// prior numbers - those frames' thicker decorative borders genuinely do
// eat more of the square, so the old formula happened to land close by
// coincidence there, not because it was measuring anything real.

export const WORLD_FRAMES = {
  1: {
    frameKey: 'frame-candy-garden',
    framePath: 'assets/frame-candy-garden.png',
    frameDisplaySize: 505,
    tileSize: 63,
    tileGap: 5,
    tileFontSize: 26,
  },
  2: {
    frameKey: 'frame-jungle-jumble',
    framePath: 'assets/frame-jungle-jumble.png',
    frameDisplaySize: 505,
    tileSize: 49,
    tileGap: 5,
    tileFontSize: 21,
  },
  3: {
    frameKey: 'frame-ocean-words',
    framePath: 'assets/frame-ocean-words.png',
    frameDisplaySize: 505,
    tileSize: 49,
    tileGap: 5,
    tileFontSize: 21,
  },
  4: {
    frameKey: 'frame-dino-valley',
    framePath: 'assets/frame-dino-valley.png',
    frameDisplaySize: 505,
    tileSize: 64,
    tileGap: 5,
    tileFontSize: 27,
  },
  5: {
    // Weakest theme match of the whole batch - "plain_leaf" was the
    // least-wrong option left over for a world named "Cloud Kingdom".
    // Worth swapping for real Cloud Kingdom art later.
    frameKey: 'frame-cloud-kingdom',
    framePath: 'assets/frame-cloud-kingdom.png',
    frameDisplaySize: 505,
    tileSize: 52,
    tileGap: 5,
    tileFontSize: 22,
  },
  6: {
    frameKey: 'frame-crystal-forest',
    framePath: 'assets/frame-crystal-forest.png',
    frameDisplaySize: 505,
    tileSize: 67,
    tileGap: 5,
    tileFontSize: 28,
  },
  7: {
    // "tribal_beads"/"tiki" read as ritual/idol imagery - closest
    // available fit to "Magic Mountain", not a purpose-built match.
    frameKey: 'frame-magic-mountain',
    framePath: 'assets/frame-magic-mountain.png',
    frameDisplaySize: 505,
    tileSize: 50,
    tileGap: 5,
    tileFontSize: 21,
    bossFrameKey: 'frame-magic-mountain-boss',
    bossFramePath: 'assets/frame-magic-mountain-boss.png',
    bossTileSize: 58,
    bossTileGap: 5,
    bossTileFontSize: 24,
  },
  8: {
    // Stands in for the batch's actual "space" frame, which has a
    // checkerboard-instead-of-transparency bug (see update.md) - this
    // sci-fi frame has no such issue and is a reasonable thematic fit.
    frameKey: 'frame-space-words',
    framePath: 'assets/frame-space-words.png',
    frameDisplaySize: 505,
    tileSize: 54,
    tileGap: 5,
    tileFontSize: 23,
  },
  9: {
    frameKey: 'frame-ancient-valley',
    framePath: 'assets/frame-ancient-valley.png',
    frameDisplaySize: 505,
    tileSize: 49,
    tileGap: 5,
    tileFontSize: 21,
  },
  10: {
    // "lagos"/"military" - a personal pick (Ayobami's home city as the
    // finale kingdom) rather than a theme match to "WordSwoop
    // Kingdom"; easy to swap out if it doesn't read right in-game.
    frameKey: 'frame-wordswoop-kingdom',
    framePath: 'assets/frame-wordswoop-kingdom.png',
    frameDisplaySize: 505,
    tileSize: 59,
    tileGap: 5,
    tileFontSize: 25,
    bossFrameKey: 'frame-wordswoop-kingdom-boss',
    bossFramePath: 'assets/frame-wordswoop-kingdom-boss.png',
    bossTileSize: 55,
    bossTileGap: 5,
    bossTileFontSize: 23,
  },
};

export function getWorldFrame(worldId) {
  return WORLD_FRAMES[worldId] ?? null;
}
