// Shared wood plank panel: fixed left/right caps + a stretchable middle
// (a manual 3-slice). Same technique SettingsScene.createPanel() and
// CalendarScene already use, pulled out here so the board HUD (top bar,
// bottom booster bar) can reuse it instead of a third copy-paste.
// SettingsScene/CalendarScene are intentionally left as they are for now.
//
// Art note: the plank's painted wood only fills ~63% of the image height
// (about 21% transparent margin above, 16% below), so a panel of height
// `h` shows a plank roughly 0.63 * h thick. Size `h` accordingly.

const WOOD_PANEL_ASSETS = [
  ['uiWoodCapLeft', 'assets/wood-cap-left.png'],
  ['uiWoodMiddle', 'assets/wood-middle.png'],
  ['uiWoodCapRight', 'assets/wood-cap-right.png'],
];

export function preloadWoodPanel(scene) {
  WOOD_PANEL_ASSETS.forEach(([key, path]) => {
    if (!scene.textures.exists(key)) scene.load.image(key, path);
  });
}

// Builds a panel spanning (x, x + w), vertically centered on y, height h.
// Returns { objects, capWidth } - `objects` are the three images so the
// caller can set depth/alpha on all of them.
export function addWoodPanel(scene, x, y, w, h) {
  const left = scene.add.image(0, 0, 'uiWoodCapLeft');
  const right = scene.add.image(0, 0, 'uiWoodCapRight');
  const mid = scene.add.image(0, 0, 'uiWoodMiddle');

  const capScale = h / left.height;
  left.setScale(capScale);
  right.setScale(capScale);
  const capWidth = left.displayWidth;

  mid.setDisplaySize(Math.max(1, w - capWidth - right.displayWidth), h);

  left.setOrigin(0, 0.5).setPosition(x, y);
  mid.setOrigin(0, 0.5).setPosition(x + capWidth, y);
  right.setOrigin(1, 0.5).setPosition(x + w, y);

  return { objects: [left, mid, right], capWidth };
}
