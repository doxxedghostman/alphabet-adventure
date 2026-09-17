import Phaser from 'phaser';
import { App } from '@capacitor/app';
import { APP_BG_COLOR, APP_BG_COLOR_RGB } from '../config.js';
import { bindHardwareBack } from '../utils/hardwareBack.js';

// Landing screen after the splash. Per chat: this now shows nothing but
// the full forest-adventure poster art (logo + two scout characters +
// baked-in "Play" banner, all one image) with a single real Play button
// overlaid exactly on top of the banner already painted into that art -
// no separate badge/gear/logo/characters icons layered on top anymore
// (those are handled on the Home Hub screen that Play leads to instead).
//
// menu-play-button.png is a crop of this exact same poster (same source
// art the poster itself was generated from), so at matching scale/position
// it lines up pixel-for-pixel with the banner already drawn into the
// poster - it reads as one seamless piece of art, but the crop on top is
// a real interactive Phaser object with tap feedback, while the full
// poster underneath is static. Per chat follow-up: no idle animation on
// this button anymore either (see HomeHubScene.js's header comment for
// why - same "white blink" complaint applied here too).
//
// The poster (720x1482) is much taller/narrower than this game's fixed
// canvas (516x1118 - see config.js/main.js), so it's shown at "cover"
// scale (fills the canvas edge to edge, cropping the minimal side
// overflow) rather than "contain" - see the scale calc below for why
// contain was the original choice and why it stopped working.
const POSTER_SIZE = { width: 720, height: 1482 };
// Exact pixel bounding box of the Play banner within the poster, found by
// template-matching menu-play-button.png against menu-characters.jpg.
const PLAY_BANNER_BOX = { x: 108, y: 1185, width: 500, height: 155 };

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  preload() {
    this.load.image('posterArt', 'assets/menu-characters.jpg');
    this.load.image('menuPlayButton', 'assets/menu-play-button.png');
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, APP_BG_COLOR).setOrigin(0);

    // "Cover" scale (was "contain"): fills the canvas edge to edge with
    // no flat-color gap, cropping the minimal overflow off the sides
    // instead. Contain (Math.min) was the original choice specifically
    // to show the whole poster uncropped, but on this app's actual
    // canvas aspect ratio (516x1118, stretched to match real phones -
    // see config.js's CANVAS_SIZE comment) vs. this poster's own
    // proportions, the leftover gap landed at the top/bottom with
    // nothing over it to hide it (unlike the Home Hub's wood bar) - see
    // update.md for the screenshot that flagged this. Cover crops a
    // little off the sides instead, which is fine here since the
    // poster's composition (logo, characters, Play banner) is centered.
    const scale = Math.max(width / POSTER_SIZE.width, height / POSTER_SIZE.height);
    const posterW = POSTER_SIZE.width * scale;
    const posterH = POSTER_SIZE.height * scale;
    const posterX = (width - posterW) / 2;
    const posterY = (height - posterH) / 2;

    const poster = this.add.image(width / 2, height / 2, 'posterArt');
    poster.setDisplaySize(posterW, posterH);

    // Map the banner's box in poster-space to this screen's actual pixels.
    const buttonW = PLAY_BANNER_BOX.width * scale;
    const buttonH = PLAY_BANNER_BOX.height * scale;
    const buttonX = posterX + PLAY_BANNER_BOX.x * scale + buttonW / 2;
    const buttonY = posterY + PLAY_BANNER_BOX.y * scale + buttonH / 2;

    const button = this.createPlayButton(buttonX, buttonY, buttonW, buttonH);

    // Simple fade/pop entrance for the poster + button so the screen
    // doesn't just appear fully-formed.
    poster.setAlpha(0);
    this.tweens.add({ targets: poster, alpha: 1, duration: 420, ease: 'Sine.easeOut' });

    button.setScale(0);
    this.tweens.add({
      targets: button,
      scale: buttonW / button.width,
      duration: 380,
      delay: 200,
      ease: 'Back.easeOut',
    });

    // This is the top of the navigation stack - nowhere left to "go
    // back" to, so the hardware back gesture here actually exits the
    // app instead of being swallowed like on every other scene.
    bindHardwareBack(this, () => App.exitApp());
  }

  createPlayButton(x, y, displayWidth, displayHeight) {
    const button = this.add.image(x, y, 'menuPlayButton');
    button.setDisplaySize(displayWidth, displayHeight);
    button.setInteractive({ useHandCursor: true });

    const baseScale = button.scale;

    button.on('pointerdown', () => {
      this.tweens.add({ targets: button, scale: baseScale * 0.94, duration: 80, ease: 'Sine.easeOut' });
    });
    button.on('pointerup', () => {
      this.tweens.add({
        targets: button,
        scale: baseScale,
        duration: 100,
        ease: 'Sine.easeOut',
        onComplete: () => this.startGame(),
      });
    });

    return button;
  }

  startGame() {
    this.cameras.main.fadeOut(280, ...APP_BG_COLOR_RGB);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('HomeHubScene');
    });
  }
}
