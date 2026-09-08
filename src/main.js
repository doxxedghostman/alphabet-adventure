import Phaser from 'phaser';
import { BoardScene } from './scenes/BoardScene.js';
import { BOARD_PIXEL_SIZE } from './config.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: BOARD_PIXEL_SIZE.width,
  height: BOARD_PIXEL_SIZE.height,
  backgroundColor: '#241a3d',
  scene: [BoardScene],
  render: {
    antialias: true,
  },
};

new Phaser.Game(config);
