import Phaser from 'phaser';
import { SplashScene } from './scenes/SplashScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { HomeHubScene } from './scenes/HomeHubScene.js';
import { WorldSelectScene } from './scenes/WorldSelectScene.js';
import { LevelPathScene } from './scenes/LevelPathScene.js';
import { BoardScene } from './scenes/BoardScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { BOARD_PIXEL_SIZE } from './config.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: BOARD_PIXEL_SIZE.width,
  height: BOARD_PIXEL_SIZE.height,
  backgroundColor: '#241a3d',
  scene: [SplashScene, MainMenuScene, HomeHubScene, WorldSelectScene, LevelPathScene, BoardScene, SettingsScene],
  render: {
    antialias: true,
  },
  // Render the game's backing framebuffer at the device's real pixel
  // density instead of 1 CSS pixel = 1 canvas pixel. Without this, the
  // fixed 516x624 canvas gets drawn once at that low resolution and then
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
