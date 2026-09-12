import Phaser from 'phaser';
import { applyRandomIdleEffect } from '../utils/effects.js';

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
// a real interactive Phaser object with tap feedback and an idle glow/
// shine effect, while the full poster underneath is static.
//
// The poster (720x1482) is much taller/narrower than this game's fixed
// canvas (516x624 - see config.js/main.js), so it's shown at "contain"
// scale (nothing cropped, full art visible - title, characters, and the
// Play banner all stay on-screen) with the leftover width filled by the
// same flat background color used elsewhere, rather than cropping into
// the art to go full-bleed.
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

    this.add.rectangle(0, 0, width, height, 0x241a3d).setOrigin(0);

    const scale = Math.min(width / POSTER_SIZE.width, height / POSTER_SIZE.height);
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
  }

  createPlayButton(x, y, displayWidth, displayHeight) {
    const button = this.add.image(x, y, 'menuPlayButton');
    button.setDisplaySize(displayWidth, displayHeight);
    button.setInteractive({ useHandCursor: true });

    const baseScale = button.scale;

    // Idle effect (glow or shine, at random) so the button still reads
    // as tappable even though it's sitting flush on top of matching art.
    const idle = applyRandomIdleEffect(this, { x, y, width: displayWidth, height: displayHeight });

    button.on('pointerdown', () => {
      idle.tween.pause();
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
    button.on('pointerout', () => {
      if (idle.tween.isPaused()) idle.tween.resume();
    });

    return button;
  }

  startGame() {
    this.cameras.main.fadeOut(280, 0x24, 0x1a, 0x3d);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('HomeHubScene');
    });
  }
}
