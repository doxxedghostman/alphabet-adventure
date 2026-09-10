import Phaser from 'phaser';
import { BOARD_PIXEL_SIZE } from '../config.js';

const STUDIO_NAME = 'Wobblewing Studios';
const GAME_TITLE = 'WordSwoop';

// Boot-time splash: studio logo pops in with a sparkle burst, then the
// game title reveals underneath, then everything fades into BoardScene.
// Tapping/clicking anywhere skips straight to the fade-out, so it never
// gets in a returning player's way.
export class SplashScene extends Phaser.Scene {
  constructor() {
    super('SplashScene');
  }

  preload() {
    this.load.image('logo', 'assets/logo.png');
  }

  create() {
    const { width, height } = this.scale;
    this.finished = false;

    this.add.rectangle(0, 0, width, height, 0x241a3d).setOrigin(0);

    this.buildSparkleTexture();

    // Ambient sparkles drifting in the background for the whole splash,
    // independent of the logo/title reveal beats below.
    this.ambientEmitter = this.add.particles(width / 2, height / 2, 'sparkle', {
      x: { min: 0, max: width },
      y: { min: 0, max: height },
      lifespan: 1400,
      speed: { min: 5, max: 20 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.8, end: 0 },
      frequency: 220,
      blendMode: 'ADD',
      tint: [0xffd93d, 0x6bc9ef, 0xf368e0],
    });

    const logo = this.add.image(width / 2, height * 0.34, 'logo').setAlpha(0).setScale(0);
    const maxLogoWidth = width * 0.78;
    const targetScale = Math.min(1, maxLogoWidth / logo.width);
    logo.setData('targetScale', targetScale);

    this.studioText = this.add
      .text(width / 2, height * 0.34 + logo.height * targetScale * 0.5 + 34, STUDIO_NAME, {
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#a79ccf',
        fontFamily: 'system-ui, sans-serif',
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.titleText = this.add
      .text(width / 2, height * 0.34 + logo.height * targetScale * 0.5 + 68, GAME_TITLE, {
        fontSize: '38px',
        fontStyle: 'bold',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(0.6);

    this.skipText = this.add
      .text(width / 2, height - 26, 'tap to skip', {
        fontSize: '12px',
        color: '#6b5f8f',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({ targets: this.skipText, alpha: 0.8, delay: 800, duration: 400 });

    this.input.once('pointerdown', () => this.skipToBoard());

    this.playSequence(logo, targetScale);
  }

  buildSparkleTexture() {
    // Small 4-pointed star, drawn once and cached as a texture so the
    // particle emitters below can stamp it cheaply many times.
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    const s = 10;
    g.beginPath();
    g.moveTo(s, 0);
    g.lineTo(s * 1.3, s * 0.8);
    g.lineTo(s * 2, s);
    g.lineTo(s * 1.3, s * 1.2);
    g.lineTo(s, s * 2);
    g.lineTo(s * 0.7, s * 1.2);
    g.lineTo(0, s);
    g.lineTo(s * 0.7, s * 0.8);
    g.closePath();
    g.fillPath();
    g.generateTexture('sparkle', s * 2, s * 2);
    g.destroy();
  }

  playSequence(logo, targetScale) {
    const { width } = this.scale;

    // Beat 1: logo pops in with a slight overshoot, then settles.
    this.tweens.add({
      targets: logo,
      alpha: 1,
      scale: targetScale * 1.12,
      duration: 480,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: logo,
          scale: targetScale,
          duration: 160,
          ease: 'Sine.easeOut',
        });
        this.burstSparkles(width / 2, logo.y, 22);
        this.cameras.main.shake(80, 0.002);

        // Beat 2: studio name fades up under the logo.
        this.tweens.add({
          targets: this.studioText,
          alpha: 1,
          y: this.studioText.y - 6,
          duration: 350,
          delay: 200,
          ease: 'Sine.easeOut',
        });

        // Beat 3: game title pops in with its own small sparkle burst.
        this.tweens.add({
          targets: this.titleText,
          alpha: 1,
          scale: 1,
          duration: 380,
          delay: 480,
          ease: 'Back.easeOut',
          onComplete: () => this.burstSparkles(width / 2, this.titleText.y, 16),
        });
      },
    });

    // Beat 4: hold, then hand off to the board.
    this.holdTimer = this.time.delayedCall(2600, () => this.skipToBoard());
  }

  burstSparkles(x, y, quantity) {
    this.add.particles(x, y, 'sparkle', {
      lifespan: 600,
      speed: { min: 80, max: 220 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD',
      tint: [0xffd93d, 0xff9f43, 0xf368e0, 0x6bc9ef],
      quantity,
      emitting: false,
    }).explode(quantity, x, y);
  }

  skipToBoard() {
    if (this.finished) return;
    this.finished = true;
    if (this.holdTimer) this.holdTimer.remove();

    this.cameras.main.fadeOut(320, 0x24, 0x1a, 0x3d);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('BoardScene');
    });
  }
}
