import Phaser from 'phaser';
import { APP_BG_COLOR, APP_BG_COLOR_RGB } from '../config.js';

const STUDIO_NAME = 'Wobblewing Studios';
const GAME_TITLE = 'WordSwoop';

// Loading bar doesn't creep smoothly - it visibly jumps to each
// checkpoint then pauses briefly, like a classic "fake" boot-loader.
// Keep this list's durations+holds small: logo/title reveal + this
// sequence + the final fade all have to land under ~3s total.
const LOADING_STEPS = [
  { to: 40, duration: 150, hold: 120 },
  { to: 70, duration: 150, hold: 120 },
  { to: 90, duration: 130, hold: 150 },
  { to: 100, duration: 120, hold: 100 },
];

// Boot-time splash: studio logo + game name appear, a loading bar
// ticks through 40% -> 70% -> 90% -> 100%, then it hands off to the
// Main Menu (not straight into the board - Play is what opens the
// board from the menu). Plays every time the app opens, not just on
// first launch. Tapping/clicking anywhere skips straight to the
// fade-out, so it never gets in an impatient player's way.
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

    this.add.rectangle(0, 0, width, height, APP_BG_COLOR).setOrigin(0);

    this.buildSparkleTexture();

    // Ambient sparkles drifting in the background for the whole splash,
    // independent of the logo/title/loading-bar beats below.
    this.ambientEmitter = this.add.particles(width / 2, height / 2, 'sparkle', {
      x: { min: 0, max: width },
      y: { min: 0, max: height },
      lifespan: 1000,
      speed: { min: 5, max: 20 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.8, end: 0 },
      frequency: 220,
      blendMode: 'ADD',
      tint: [0xffd93d, 0x6bc9ef, 0xf368e0],
    });

    const logo = this.add.image(width / 2, height * 0.3, 'logo').setAlpha(0).setScale(0);
    const maxLogoWidth = width * 0.72;
    const targetScale = Math.min(1, maxLogoWidth / logo.width);

    this.studioText = this.add
      .text(width / 2, height * 0.3 + logo.height * targetScale * 0.5 + 30, STUDIO_NAME, {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#a79ccf',
        fontFamily: 'system-ui, sans-serif',
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.titleText = this.add
      .text(width / 2, height * 0.3 + logo.height * targetScale * 0.5 + 62, GAME_TITLE, {
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(0.6);

    this.buildLoadingBar(width / 2, this.titleText.y + 48, width * 0.55);

    this.input.once('pointerdown', () => this.skipToMenu());

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

  buildLoadingBar(centerX, y, barWidth) {
    const barHeight = 8;
    const barX = centerX - barWidth / 2;

    this.loadingTrack = this.add
      .rectangle(barX, y, barWidth, barHeight, 0xffffff, 0.12)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, 0xffffff, 0.25)
      .setAlpha(0);

    this.loadingFill = this.add
      .rectangle(barX, y, 0, barHeight, 0xffd93d)
      .setOrigin(0, 0.5)
      .setAlpha(0);

    this.loadingPercentText = this.add
      .text(centerX, y + 18, '0%', {
        fontSize: '12px',
        color: '#a79ccf',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.loadingBarWidth = barWidth;
  }

  setLoadingProgress(percent) {
    this.loadingFill.width = this.loadingBarWidth * (percent / 100);
    this.loadingPercentText.setText(`${Math.round(percent)}%`);
  }

  playSequence(logo, targetScale) {
    const { width } = this.scale;

    // Beat 1: logo pops in with a slight overshoot, then settles.
    this.tweens.add({
      targets: logo,
      alpha: 1,
      scale: targetScale * 1.12,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (this.finished) return;

        this.tweens.add({
          targets: logo,
          scale: targetScale,
          duration: 140,
          ease: 'Sine.easeOut',
        });
        this.burstSparkles(width / 2, logo.y, 20);
        this.cameras.main.shake(70, 0.002);

        // Beat 2: studio name fades up under the logo.
        this.tweens.add({
          targets: this.studioText,
          alpha: 1,
          y: this.studioText.y - 6,
          duration: 280,
          delay: 140,
          ease: 'Sine.easeOut',
        });

        // Beat 3: game title pops in with its own small sparkle burst,
        // then the loading bar fades in and starts ticking through its
        // checkpoints.
        this.tweens.add({
          targets: this.titleText,
          alpha: 1,
          scale: 1,
          duration: 320,
          delay: 340,
          ease: 'Back.easeOut',
          onComplete: () => {
            if (this.finished) return;
            this.burstSparkles(width / 2, this.titleText.y, 14);

            this.tweens.add({
              targets: [this.loadingTrack, this.loadingFill, this.loadingPercentText],
              alpha: { from: 0, to: [0.9, 1, 0.8] },
              duration: 150,
              onComplete: () => this.runLoadingSequence(0, { value: 0 }),
            });
          },
        });
      },
    });
  }

  runLoadingSequence(index, progressState) {
    if (this.finished) return;

    if (index >= LOADING_STEPS.length) {
      this.time.delayedCall(80, () => this.skipToMenu());
      return;
    }

    const step = LOADING_STEPS[index];
    this.tweens.add({
      targets: progressState,
      value: step.to,
      duration: step.duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.setLoadingProgress(progressState.value),
      onComplete: () => {
        if (this.finished) return;
        this.time.delayedCall(step.hold, () => this.runLoadingSequence(index + 1, progressState));
      },
    });
  }

  burstSparkles(x, y, quantity) {
    this.add.particles(x, y, 'sparkle', {
      lifespan: 550,
      speed: { min: 80, max: 220 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD',
      tint: [0xffd93d, 0xff9f43, 0xf368e0, 0x6bc9ef],
      quantity,
      emitting: false,
    }).explode(quantity, x, y);
  }

  skipToMenu() {
    if (this.finished) return;
    this.finished = true;

    this.cameras.main.fadeOut(300, ...APP_BG_COLOR_RGB);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MainMenuScene');
    });
  }
}
