import Phaser from 'phaser';
import { SplashScene } from './scenes/SplashScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { WorldSelectScene } from './scenes/WorldSelectScene.js';
import { LevelPathScene } from './scenes/LevelPathScene.js';
import { BoardScene } from './scenes/BoardScene.js';
import { BOARD_PIXEL_SIZE } from './config.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: BOARD_PIXEL_SIZE.width,
  height: BOARD_PIXEL_SIZE.height,
  backgroundColor: '#241a3d',
  scene: [SplashScene, MainMenuScene, WorldSelectScene, LevelPathScene, BoardScene],
  render: {
    antialias: true,
  },
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
