import Phaser from 'phaser';

// Landing screen after the splash. Just a Play button for now - World
// Map / Daily Challenge / Achievements / Settings (see PLAN.md section
// 1) get added here as the game expands, this isn't the final layout.
//
// Art: sourced from the forest-adventure mockup (logo lockup, the two
// scout characters holding letter blocks, and the wood/gem "Play" pill),
// each cropped out with a feathered edge so it sits cleanly on the flat
// game background without a hard rectangle border. The mockup itself is
// a tall poster shape that doesn't match the game's canvas aspect ratio,
// so the pieces are laid out fresh here rather than shown as one image.
//
// Sizing below (0.60/0.66/0.46 width fractions, 0.025 top offset) is
// hand-fitted to this game's actual fixed canvas (516x624 - see
// config.js/main.js) so the button lands fully on-screen with a small
// bottom margin. Since Phaser.Scale.FIT scales that whole fixed canvas
// uniformly to any real device, this fits phones and tablets alike
// without any separate per-device logic - it just has to fit the fixed
// logical canvas once.
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  preload() {
    this.load.image('menuLogo', 'assets/menu-logo.png');
    this.load.image('menuCharacters', 'assets/menu-characters.png');
    this.load.image('menuPlayButton', 'assets/menu-play-button.png');
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0x241a3d).setOrigin(0);

    // Logo lockup: gems + "Word Swoop" + tagline ribbon, anchored to the top.
    const logo = this.add.image(width / 2, height * 0.025, 'menuLogo').setOrigin(0.5, 0);
    logo.setScale(Math.min(1, (width * 0.6) / logo.width));

    // Two scout characters holding letter blocks, overlapping slightly into
    // the tagline ribbon above so there's no dead gap between the pieces.
    const characters = this.add
      .image(width / 2, logo.y + logo.displayHeight - 10, 'menuCharacters')
      .setOrigin(0.5, 0);
    characters.setScale(Math.min(1, (width * 0.66) / characters.width));

    // Gentle idle bob so the menu doesn't feel static.
    this.tweens.add({
      targets: characters,
      y: characters.y - 8,
      duration: 1800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    this.createPlayButton(width / 2, characters.y + characters.displayHeight + 16);
  }

  createPlayButton(x, y) {
    const button = this.add.image(x, y, 'menuPlayButton').setOrigin(0.5, 0);
    button.setScale(Math.min(1, (this.scale.width * 0.46) / button.width));
    button.setInteractive({ useHandCursor: true });

    // Slow idle pulse to invite a tap.
    this.pulseTween = this.tweens.add({
      targets: button,
      scale: button.scale * 1.045,
      duration: 750,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    button.on('pointerdown', () => {
      this.pulseTween.pause();
      this.tweens.add({ targets: button, scale: button.scale * 0.94, duration: 80, ease: 'Sine.easeOut' });
    });
    button.on('pointerup', () => {
      this.tweens.add({
        targets: button,
        scale: button.scale / 0.94,
        duration: 100,
        ease: 'Sine.easeOut',
        onComplete: () => this.startGame(),
      });
    });
    button.on('pointerout', () => {
      if (this.pulseTween.isPaused()) this.pulseTween.resume();
    });
  }

  startGame() {
    this.cameras.main.fadeOut(280, 0x24, 0x1a, 0x3d);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('WorldSelectScene');
    });
  }
}
