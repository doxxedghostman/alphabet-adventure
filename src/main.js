import Phaser from 'phaser';
import { SplashScene } from './scenes/SplashScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { HomeHubScene } from './scenes/HomeHubScene.js';
import { WorldSelectScene } from './scenes/WorldSelectScene.js';
import { LevelPathScene } from './scenes/LevelPathScene.js';
import { BoardScene } from './scenes/BoardScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { CalendarScene } from './scenes/CalendarScene.js';
import { LeaderboardScene } from './scenes/LeaderboardScene.js';
import { getCanvasSize, LETTERBOX_BG_HEX } from './config.js';
import { initAuth } from './utils/authStore.js';
import { initAds } from './utils/adsStore.js';

const CANVAS_SIZE = getCanvasSize();

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: CANVAS_SIZE.width,
  height: CANVAS_SIZE.height,
  backgroundColor: LETTERBOX_BG_HEX,
  scene: [SplashScene, MainMenuScene, HomeHubScene, WorldSelectScene, LevelPathScene, BoardScene, SettingsScene, CalendarScene, LeaderboardScene],
  render: {
    antialias: true,
  },
  // Render the game's backing framebuffer at the device's real pixel
  // density instead of 1 CSS pixel = 1 canvas pixel. Without this, the
  // fixed-resolution canvas gets drawn once at that low resolution and then
  // stretched up by both Phaser.Scale.FIT and the phone's own pixel
  // ratio (100vw/100vh in index.html routinely blows this up 1.5-3x) -
  // that's what was making every icon and image look soft/blurry, not
  // the source art itself. Capped at 3 so very high-DPR devices don't
  // pay for framebuffer sizes with no visible benefit.
  resolution: Math.min(window.devicePixelRatio || 1, 3),
  // FIT scales the fixed-resolution board to whatever size #game-container
  // is (set by the bordered #game-frame in index.html) while preserving
  // aspect ratio, so the board always sits inside a phone-shaped panel
  // instead of rendering at native pixel size and overflowing/stretching.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

window.game = new Phaser.Game(config);

// Corrects the letterbox-strip flicker per chat: getCanvasSize() above
// only ran once, at this module's very first execution, and that
// reading can race against MainActivity.java's hideSystemBars() -
// going immersive is an async native-side animation, not instant, so
// window.innerHeight at that exact JS-boot instant may still reflect
// the shorter pre-immersive viewport (nav bar still visible/
// animating away). Whichever aspect ratio got measured at that moment
// was then locked into the canvas forever, with nothing to
// re-measure later - showing as the cream letterbox bars on launches
// where JS happened to run first, and not on launches where the bars
// had already finished hiding by then. Re-deriving the size and
// pushing it into Phaser's own ScaleManager (which re-lays-out FIT
// scaling for the new dimensions) whenever the real viewport changes
// - or shortly after boot even with no explicit resize event, via the
// double rAF below, since "wrong from frame one and nothing changes
// again after" wouldn't otherwise fire a 'resize' at all - keeps the
// canvas's ratio matched to the actual current viewport instead of
// whatever transient size existed at construction.
function syncCanvasSize() {
  if (!window.game?.scale) return;
  const size = getCanvasSize();
  window.game.scale.resize(size.width, size.height);
}

window.requestAnimationFrame(() => window.requestAnimationFrame(syncCanvasSize));
window.addEventListener('resize', syncCanvasSize);
window.addEventListener('orientationchange', syncCanvasSize);

// Fire-and-forget: picks up an existing session and starts listening
// for sign-in/sign-out. Doesn't block game boot - Phaser starts
// immediately with SplashScene regardless, since guest play never
// waits on auth (see authStore.js's header comment).
initAuth();

// Fire-and-forget, same reasoning as initAuth() - AdMob's own init is
// a no-op on web (see adsStore.js), so this is safe to call
// unconditionally rather than checking platform here too.
initAds();
