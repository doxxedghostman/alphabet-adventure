import Phaser from 'phaser';
import { WORLDS } from '../data/worlds.js';
import { unlockedWorldCount, resetProgress } from '../utils/progressStore.js';

// Landing screen after the splash. World Map / Daily Challenge /
// Achievements (see PLAN.md section 1) get added here as the game
// expands, this isn't the final layout - only Settings (real: reset
// progress) and a real "Worlds Unlocked" badge are wired up so far.
// Everything else in the reference mockup (shop, gallery, trophy,
// leaderboard, calendar/daily reward, spin wheel, video rewards) is
// skipped for now since those systems don't exist yet - see chat.
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

    this.createHud(width);

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

    const button = this.createPlayButton(width / 2, characters.y + characters.displayHeight + 16);

    // Staggered entrance: logo/characters drop+fade in, button pops in
    // after, so the screen doesn't just appear fully-formed.
    this.playEntrance([logo, characters], button);
  }

  playEntrance(dropTargets, button) {
    dropTargets.forEach((target, i) => {
      const finalY = target.y;
      target.y = finalY - 24;
      target.alpha = 0;
      this.tweens.add({
        targets: target,
        y: finalY,
        alpha: 1,
        duration: 420,
        delay: i * 90,
        ease: 'Back.easeOut',
      });
    });

    const finalScale = button.scale;
    button.setScale(0);
    this.tweens.add({
      targets: button,
      scale: finalScale,
      duration: 380,
      delay: dropTargets.length * 90 + 120,
      ease: 'Back.easeOut',
      onComplete: () => this.startIdlePulse(button, finalScale),
    });
  }

  createPlayButton(x, y) {
    const button = this.add.image(x, y, 'menuPlayButton').setOrigin(0.5, 0);
    button.setScale(Math.min(1, (this.scale.width * 0.46) / button.width));
    button.setInteractive({ useHandCursor: true });

    button.on('pointerdown', () => {
      if (this.pulseTween) this.pulseTween.pause();
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
      if (this.pulseTween && this.pulseTween.isPaused()) this.pulseTween.resume();
    });

    return button;
  }

  // Idle pulse only starts once the entrance pop-in finishes, otherwise
  // the two scale tweens fight each other.
  startIdlePulse(button, baseScale) {
    this.pulseTween = this.tweens.add({
      targets: button,
      scale: baseScale * 1.045,
      duration: 750,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  startGame() {
    this.cameras.main.fadeOut(280, 0x24, 0x1a, 0x3d);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('HomeHubScene');
    });
  }

  // --- HUD: worlds-unlocked badge (real data) + settings (real: reset progress) ---

  createHud(width) {
    this.createWorldsBadge(16);
    this.createSettingsButton(width - 16);
  }

  createWorldsBadge(x) {
    const count = unlockedWorldCount(WORLDS.length);
    const label = `\u{1F5FA} ${count}/${WORLDS.length} Worlds`;

    const text = this.add.text(x, 14, label, {
      fontFamily: 'Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    text.setOrigin(0, 0);
    text.setPadding(10, 6, 10, 6);
    text.setBackgroundColor('#3a2a5c');

    // Pop-in on load, then a slow idle pulse so it doesn't sit dead.
    text.setScale(0);
    this.tweens.add({
      targets: text,
      scale: 1,
      duration: 350,
      delay: 500,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: text,
          scale: 1.04,
          duration: 1200,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
        });
      },
    });
  }

  createSettingsButton(rightEdgeX) {
    const size = 36;
    const x = rightEdgeX - size / 2;
    const y = 14 + size / 2;

    const circle = this.add.circle(x, y, size / 2, 0x3a2a5c, 1);
    circle.setStrokeStyle(2, 0xffffff, 0.9);
    const gear = this.add.text(x, y, '\u2699', { fontFamily: 'Arial', fontSize: '20px', color: '#ffffff' });
    gear.setOrigin(0.5);

    const hit = this.add.circle(x, y, size / 2, 0xffffff, 0).setInteractive({ useHandCursor: true });

    // Slow continuous idle rotation on the gear glyph itself.
    this.tweens.add({ targets: gear, angle: 360, duration: 8000, repeat: -1, ease: 'Linear' });

    // Entrance pop, matching the badge's timing/style.
    [circle, gear].forEach((t) => t.setScale(0));
    this.tweens.add({ targets: [circle, gear], scale: 1, duration: 350, delay: 560, ease: 'Back.easeOut' });

    hit.on('pointerup', () => {
      this.tweens.add({ targets: [circle, gear], scale: 0.85, duration: 70, yoyo: true, ease: 'Sine.easeOut' });
      this.openSettings();
    });
  }

  openSettings() {
    if (this.settingsPanel) return; // already open
    const { width, height } = this.scale;

    const scrim = this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0);
    scrim.setInteractive(); // swallow taps behind the panel

    const panelWidth = width * 0.78;
    const panelHeight = 220;
    const panelX = width / 2;
    const panelY = height / 2;

    const panel = this.add.graphics();
    panel.fillStyle(0x2f2350, 1);
    panel.fillRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 14);
    panel.lineStyle(3, 0xffffff, 0.8);
    panel.strokeRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 14);

    const title = this.add
      .text(panelX, panelY - panelHeight / 2 + 28, 'Settings', {
        fontFamily: 'Arial',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.settingsPanel = this.add.container(0, 0, [scrim, panel, title]);
    this.settingsPanel.setScale(0.85);
    this.settingsPanel.alpha = 0;
    this.tweens.add({ targets: this.settingsPanel, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });

    this.createResetButton(panelX, panelY - 10);
    this.createCloseButton(panelX, panelY + panelHeight / 2 - 34);
  }

  createResetButton(x, y) {
    const btn = this.makeSettingsButton(x, y, 'Reset Progress', '#c0392b');
    btn.on('pointerup', () => {
      this.confirmingReset ? this.doReset() : this.armResetConfirm(btn);
    });
    this.settingsPanel.add([btn.bg, btn.label, btn]);
  }

  armResetConfirm(btn) {
    this.confirmingReset = true;
    btn.label.setText('Tap again to confirm');
    this.tweens.add({ targets: [btn.bg, btn.label], scale: 1.06, duration: 90, yoyo: true, ease: 'Sine.easeOut' });
    this.time.delayedCall(2500, () => {
      this.confirmingReset = false;
      if (btn.label.active) btn.label.setText('Reset Progress');
    });
  }

  doReset() {
    resetProgress();
    this.confirmingReset = false;
    this.closeSettings();
    this.scene.restart(); // refresh the worlds-unlocked badge against the now-empty save
  }

  createCloseButton(x, y) {
    const btn = this.makeSettingsButton(x, y, 'Close', '#3a2a5c');
    btn.on('pointerup', () => this.closeSettings());
    this.settingsPanel.add([btn.bg, btn.label, btn]);
  }

  makeSettingsButton(x, y, label, color) {
    const w = 200;
    const h = 40;
    const bg = this.add.rectangle(x, y, w, h, Phaser.Display.Color.HexStringToColor(color).color, 1);
    bg.setStrokeStyle(2, 0xffffff, 0.8);
    const text = this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    text.setOrigin(0.5);

    const hit = this.add.rectangle(x, y, w, h, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.tweens.add({ targets: [bg, text], scale: 0.95, duration: 70 }));
    hit.on('pointerup', () => this.tweens.add({ targets: [bg, text], scale: 1, duration: 100 }));
    return Object.assign(hit, { bg, label: text });
  }

  closeSettings() {
    if (!this.settingsPanel) return;
    const panel = this.settingsPanel;
    this.settingsPanel = null;
    this.confirmingReset = false;
    this.tweens.add({
      targets: panel,
      scale: 0.85,
      alpha: 0,
      duration: 160,
      ease: 'Sine.easeIn',
      onComplete: () => panel.destroy(),
    });
  }
}
