import Phaser from 'phaser';
import { resetProgress } from '../utils/progressStore.js';

// Home Hub (per chat): sits between the splash/logo Main Menu and the
// World Map. Modeled on the reference mockup image the user provided -
// avatar/name/currency/settings bar, a shop/gallery/trophy/leaderboard
// column on the left, a shop/calendar/spin-wheel/video column on the
// right, a logo + mini map preview in the center, and a big "Word Map"
// button at the bottom that's the only way forward from here.
//
// Per chat: only the Word Map button and Settings (reset progress,
// reusing the same panel as MainMenuScene) are real. Every other icon
// (shop x2, gallery, trophy, leaderboard, calendar, spin wheel, video)
// is shown fully styled and tappable per the user's explicit choice,
// even though none of those systems exist yet - tapping one shows a
// "Coming Soon" toast rather than doing nothing or looking disabled.
//
// All icons are code-drawn (rounded-rect badge + a Unicode glyph),
// same visual language as the star/lock glyphs already used in
// LevelPathScene/WorldSelectScene - no new art assets needed here.
// Avatar/name/currency are placeholders (no account or economy system
// exists yet) rather than real data.
export class HomeHubScene extends Phaser.Scene {
  constructor() {
    super('HomeHubScene');
  }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x241a3d).setOrigin(0);

    this.createTopBar(width);
    this.createLogoAndMapPreview(width);
    this.createIconColumn('left', 16);
    this.createIconColumn('right', width - 16 - 56);
    this.createWordMapButton(width, height);
  }

  // --- Top bar: avatar, name, currency, add-currency, settings -----------

  createTopBar(width) {
    const barHeight = 52;
    const bar = this.add.graphics();
    bar.fillStyle(0x3a2a5c, 1);
    bar.fillRoundedRect(10, 8, width - 20, barHeight, 12);
    bar.lineStyle(2, 0xffffff, 0.5);
    bar.strokeRoundedRect(10, 8, width - 20, barHeight, 12);

    const cy = 8 + barHeight / 2;

    // Avatar (placeholder - no account system yet)
    this.add.circle(38, cy, 18, 0x8f5c3c, 1).setStrokeStyle(2, 0xffffff, 0.9);
    this.add.text(38, cy, '\u{1F9D2}', { fontSize: '20px' }).setOrigin(0.5);

    this.add.text(64, cy, 'Guest_Player', {
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0, 0.5);

    // Currency (placeholder - no economy system yet)
    const currencyX = width - 118;
    this.add.text(currencyX, cy, '\u{1F451}', { fontSize: '18px' }).setOrigin(0.5);
    this.add.text(currencyX + 16, cy, '0', {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffd93d',
    }).setOrigin(0, 0.5);

    this.createSmallIconButton(width - 78, cy, '+', '#c0392b', () => this.comingSoon());
    this.createSmallIconButton(width - 34, cy, '\u2699', '#8e44ad', () => this.openSettings());
  }

  createSmallIconButton(x, y, glyph, color, onTap) {
    const r = 16;
    const circle = this.add.circle(x, y, r, Phaser.Display.Color.HexStringToColor(color).color, 1);
    circle.setStrokeStyle(2, 0xffffff, 0.85);
    const label = this.add.text(x, y, glyph, { fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    const hit = this.add.circle(x, y, r, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.tweens.add({ targets: [circle, label], scale: 0.85, duration: 70 }));
    hit.on('pointerup', () => {
      this.tweens.add({ targets: [circle, label], scale: 1, duration: 100 });
      onTap();
    });
  }

  // --- Center: logo + decorative mini map preview -------------------------

  createLogoAndMapPreview(width) {
    const logo = this.add.image(width / 2, 76, 'menuLogo').setOrigin(0.5, 0);
    logo.setScale(Math.min(1, (width * 0.42) / logo.width));

    const ribbonY = logo.y + logo.displayHeight + 6;
    this.add.text(width / 2, ribbonY, 'Word Map', {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#3a2a5c',
    }).setOrigin(0.5).setPadding(14, 5, 14, 5).setBackgroundColor('#f0c987');

    // Decorative preview of the real map - a few code-drawn nodes on a
    // parchment card, same lock/star visual language as the real
    // WorldSelectScene/LevelPathScene. Not interactive - it's a teaser
    // for the button just below it, not a shortcut around it.
    const cardW = width * 0.62;
    const cardH = 120;
    const cardX = width / 2 - cardW / 2;
    const cardY = ribbonY + 34;

    const card = this.add.graphics();
    card.fillStyle(0xe8d9b0, 1);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, 10);
    card.lineStyle(3, 0x8b6b3d, 1);
    card.strokeRoundedRect(cardX, cardY, cardW, cardH, 10);

    const previewNodes = [
      { dx: 0.18, dy: 0.72, state: 'locked' },
      { dx: 0.38, dy: 0.42, state: 'locked' },
      { dx: 0.62, dy: 0.62, state: 'locked' },
      { dx: 0.82, dy: 0.28, state: 'star' },
    ];
    const line = this.add.graphics();
    line.lineStyle(3, 0x8b6b3d, 0.7);
    line.beginPath();
    previewNodes.forEach((n, i) => {
      const x = cardX + cardW * n.dx;
      const y = cardY + cardH * n.dy;
      if (i === 0) line.moveTo(x, y);
      else line.lineTo(x, y);
    });
    line.strokePath();

    previewNodes.forEach((n) => {
      const x = cardX + cardW * n.dx;
      const y = cardY + cardH * n.dy;
      const dot = this.add.graphics();
      dot.fillStyle(n.state === 'star' ? 0xffc93c : 0x8f8f9c, 1);
      dot.fillCircle(x, y, 13);
      dot.lineStyle(2, 0xffffff, 0.9);
      dot.strokeCircle(x, y, 13);
      const glyph = n.state === 'star' ? '\u2605' : '\u{1F512}';
      this.add.text(x, y, glyph, { fontSize: '13px' }).setOrigin(0.5);
    });

    this.mapPreviewBottom = cardY + cardH;
  }

  // --- Side icon columns ---------------------------------------------------

  createIconColumn(side, x) {
    const icons = side === 'left'
      ? [
        { glyph: '\u{1F3EA}', color: '#c0392b' }, // shop
        { glyph: '\u{1F5BC}', color: '#2980b9' }, // gallery
        { glyph: '\u{1F3C6}', color: '#f39c12' }, // trophy
        { glyph: '\u{1F947}', color: '#8e44ad' }, // leaderboard
      ]
      : [
        { glyph: '\u{1F6D2}', color: '#c0392b' }, // coin shop
        { glyph: '\u{1F4C5}', color: '#27ae60' }, // daily calendar
        { glyph: '\u{1F3A1}', color: '#e91e8c' }, // spin wheel
        { glyph: '\u25B6', color: '#2980b9' }, // video reward
      ];

    const top = 90;
    const gap = 78;
    icons.forEach((icon, i) => this.createColumnIcon(x, top + i * gap, icon.glyph, icon.color));
  }

  createColumnIcon(x, y, glyph, color) {
    const size = 52;
    const bg = this.add.graphics();
    bg.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1);
    bg.fillRoundedRect(x, y, size, size, 12);
    bg.lineStyle(2, 0xffffff, 0.85);
    bg.strokeRoundedRect(x, y, size, size, 12);

    const label = this.add.text(x + size / 2, y + size / 2, glyph, { fontSize: '24px' }).setOrigin(0.5);

    const hit = this.add.rectangle(x, y, size, size, 0xffffff, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.tweens.add({ targets: [bg, label], scale: 0.9, duration: 70 }));
    hit.on('pointerup', () => {
      this.tweens.add({ targets: [bg, label], scale: 1, duration: 100 });
      this.comingSoon();
    });
  }

  comingSoon() {
    const { width, height } = this.scale;
    const toast = this.add.text(width / 2, height - 90, 'Coming Soon!', {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5).setPadding(14, 8, 14, 8).setBackgroundColor('#000000aa');
    toast.alpha = 0;
    toast.y += 10;
    this.tweens.add({
      targets: toast,
      alpha: 1,
      y: toast.y - 10,
      duration: 180,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.time.delayedCall(900, () => {
          this.tweens.add({ targets: toast, alpha: 0, duration: 220, onComplete: () => toast.destroy() });
        });
      },
    });
  }

  // --- Bottom: the real navigation forward ----------------------------------

  createWordMapButton(width, height) {
    const w = width * 0.7;
    const h = 54;
    const x = width / 2;
    const y = height - 44;

    const bg = this.add.graphics();
    bg.fillStyle(0x2980b9, 1);
    bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 16);
    bg.lineStyle(3, 0xffffff, 0.9);
    bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16);

    const label = this.add.text(x, y, 'Word Map', {
      fontFamily: 'Arial',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    const hit = this.add.rectangle(x, y, w, h, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.tweens.add({ targets: [bg, label], scale: 0.96, duration: 70 }));
    hit.on('pointerup', () => {
      this.tweens.add({
        targets: [bg, label],
        scale: 1,
        duration: 100,
        onComplete: () => {
          this.cameras.main.fadeOut(220, 0x24, 0x1a, 0x3d);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('WorldSelectScene');
          });
        },
      });
    });
  }

  // --- Settings (identical behavior to MainMenuScene's panel) --------------

  openSettings() {
    if (this.settingsPanel) return;
    const { width, height } = this.scale;

    const scrim = this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0);
    scrim.setInteractive();

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
    this.scene.restart();
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
