import Phaser from 'phaser';

const STUDIO_NAME = 'Wobblewing Studios';
const GAME_TITLE = 'WordSwoop';

// Landing screen after the splash. Just a Play button for now - World
// Map / Daily Challenge / Achievements / Settings (see PLAN.md section
// 1) get added here as the game expands, this isn't the final layout.
//
// Relies on the 'logo' texture already being loaded - SplashScene always
// runs immediately before this scene in the boot sequence and loads it,
// so no preload() is needed here.
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0x241a3d).setOrigin(0);

    const logo = this.add.image(width / 2, height * 0.26, 'logo');
    const maxLogoWidth = width * 0.55;
    logo.setScale(Math.min(1, maxLogoWidth / logo.width));

    this.add
      .text(width / 2, height * 0.26 + (logo.displayHeight / 2) + 26, GAME_TITLE, {
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.26 + (logo.displayHeight / 2) + 60, STUDIO_NAME, {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#a79ccf',
        fontFamily: 'system-ui, sans-serif',
        letterSpacing: 1,
      })
      .setOrigin(0.5);

    this.createPlayButton(width / 2, height * 0.68);
  }

  createPlayButton(x, y) {
    const buttonWidth = 200;
    const buttonHeight = 62;

    const button = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0xffd93d, 1);
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 18);
    bg.lineStyle(3, 0x1b1030, 0.35);
    bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 18);

    const label = this.add
      .text(0, 0, 'PLAY', {
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#1b1030',
        fontFamily: 'system-ui, sans-serif',
        letterSpacing: 1,
      })
      .setOrigin(0.5);

    button.add([bg, label]);
    button.setSize(buttonWidth, buttonHeight);
    button.setInteractive({ useHandCursor: true });

    button.on('pointerdown', () => {
      this.tweens.add({ targets: button, scale: 0.94, duration: 80, ease: 'Sine.easeOut' });
    });
    button.on('pointerup', () => {
      this.tweens.add({
        targets: button,
        scale: 1,
        duration: 100,
        ease: 'Sine.easeOut',
        onComplete: () => this.startGame(),
      });
    });
    button.on('pointerout', () => {
      this.tweens.add({ targets: button, scale: 1, duration: 100, ease: 'Sine.easeOut' });
    });
  }

  startGame() {
    this.cameras.main.fadeOut(280, 0x24, 0x1a, 0x3d);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('BoardScene', { levelId: 1 });
    });
  }
}
