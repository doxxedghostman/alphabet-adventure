import Phaser from 'phaser';
import { resetProgress } from '../utils/progressStore.js';

// Home Hub (per chat): sits between the splash/logo Main Menu and the
// World Map. Modeled on the reference mockup image the user provided -
// avatar/name/currency/settings bar, a shop/gallery/trophy/leaderboard
// column on the left, a coin-shop/calendar/video column on the right,
// a logo + mini map preview in the center, and a big "Word Map" button
// at the bottom that's the only way forward from here.
//
// Per chat: only the Word Map button and Settings (reset progress,
// reusing the same panel as MainMenuScene) are real. The remaining
// icons (shop, gallery, trophy, leaderboard, coin shop, calendar,
// video) are shown but inert - tap just does the press-down bounce,
// no toast/popup, since none of those systems exist yet.
//
// Art: swapped from code-drawn placeholders to the real generated art
// (forest bg, wood top bar, word-map banner, mini map parchment card,
// 8 side icons, decorative letter blocks) once the user sent it over.
// Icons were re-keyed for transparency on our end (originals had a flat
// white background baked in, not real alpha) before being added.
//
// Per chat follow-up: the glow/shine idle-animation pass from
// utils/effects.js (applied here to the "+" button, every icon, the
// map preview's star node, the letter blocks, and the Word Map button)
// plus the semi-transparent white backing card behind every icon were
// producing a "white blink" artifact on-device - removed entirely.
// Icons now sit directly on the forest background with no backing box
// and no idle animation anywhere in this scene, only the existing
// press-down/up tap bounce (no toast/popup on tap either). The
// spin-wheel icon was dropped from the right column too (not needed)
// rather than kept and fixed. "Guest_Player" placeholder text was also
// dropped from the top bar - real profile/settings icons and account
// data (Google sign-in + Supabase) are coming next.
export class HomeHubScene extends Phaser.Scene {
  constructor() {
    super('HomeHubScene');
  }

  preload() {
    // Loaded here directly (not inherited from MainMenuScene's load order)
    // since this scene owns its own use of the logo.
    this.load.image('menuLogo', 'assets/menu-logo.png');
    this.load.image('hubTopBar', 'assets/top-bar.png');
    this.load.image('hubWordMapBanner', 'assets/word-map-banner.png');
    this.load.image('hubWordMapButton', 'assets/word-map-button.png');
    this.load.image('hubMapPreviewCard', 'assets/map-preview-card.jpg');
    this.load.image('hubForestBg', 'assets/forest-background.jpg');
    this.load.image('hubLetterBlocks', 'assets/letter-blocks-strip.png');

    this.load.image('iconShop', 'assets/icon-shop.png');
    this.load.image('iconGallery', 'assets/icon-gallery.png');
    this.load.image('iconTrophy', 'assets/icon-trophy.png');
    this.load.image('iconLeaderboard', 'assets/icon-leaderboard.png');
    this.load.image('iconCoinShop', 'assets/icon-coin-shop.png');
    this.load.image('iconCalendar', 'assets/icon-calendar.png');
    this.load.image('iconVideo', 'assets/icon-video.png');
  }

  create() {
    const { width, height } = this.scale;

    this.createBackground(width, height);
    this.createTopBar(width);
    this.createLogoAndMapPreview(width);
    this.createIconColumn('left', 16);
    this.createIconColumn('right', width - 16 - 56);
    this.createWordMapButton(width, height);
  }

  // --- Background -----------------------------------------------------------

  createBackground(width, height) {
    // Forest bg is portrait-ish (600x900) but not the same aspect as the
    // fixed game canvas - scale to cover width and center vertically so
    // it fills the frame with no letterboxing, same idea as a CSS
    // background-size: cover.
    const bg = this.add.image(width / 2, height / 2, 'hubForestBg');
    const scale = Math.max(width / bg.width, height / bg.height);
    bg.setScale(scale);
    // Dim it slightly so the UI on top stays readable, same role the
    // flat 0x241a3d rectangle used to play.
    this.add.rectangle(0, 0, width, height, 0x1a1030, 0.45).setOrigin(0);
  }

  // --- Top bar: avatar, name, currency, add-currency, settings -----------

  createTopBar(width) {
    const barHeight = 64;
    const barY = 8;

    const bar = this.add.image(width / 2, barY, 'hubTopBar').setOrigin(0.5, 0);
    bar.setDisplaySize(width - 20, barHeight);

    const cy = barY + barHeight / 2;

    // Avatar (placeholder - no account system yet; real profile icon +
    // account data coming with the Google sign-in / Supabase work).
    this.add.circle(38, cy, 18, 0x8f5c3c, 1).setStrokeStyle(2, 0xffffff, 0.9);
    this.add.text(38, cy, '\u{1F9D2}', { fontSize: '20px' }).setOrigin(0.5);

    // Currency (placeholder - no economy system yet)
    const currencyX = width - 118;
    this.add.text(currencyX, cy, '\u{1F451}', { fontSize: '18px' }).setOrigin(0.5);
    this.add.text(currencyX + 16, cy, '0', {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#8a5a1c',
    }).setOrigin(0, 0.5);

    this.createSmallIconButton(width - 78, cy, '+', '#c0392b', () => {});
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
    return { targets: [circle, label] };
  }

  // --- Center: logo + decorative mini map preview -------------------------

  createLogoAndMapPreview(width) {
    const logo = this.add.image(width / 2, 76, 'menuLogo').setOrigin(0.5, 0);
    logo.setScale(Math.min(1, (width * 0.42) / logo.width));

    const ribbonY = logo.y + logo.displayHeight + 6;
    const banner = this.add.image(width / 2, ribbonY, 'hubWordMapBanner').setOrigin(0.5, 0);
    banner.setDisplaySize(210, 66);
    this.add.text(width / 2, ribbonY + 33, 'Word Map', {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#4a2f10',
    }).setOrigin(0.5);

    // Mini map preview - real parchment art (cropped to a wide strip
    // from the square source) with the same code-drawn lock/star nodes
    // and dashed path overlaid on top, same visual language as the real
    // WorldSelectScene/LevelPathScene. Not interactive - it's a teaser
    // for the button just below it, not a shortcut around it.
    const cardW = width * 0.64;
    const cardH = 130;
    const cardX = width / 2 - cardW / 2;
    const cardY = ribbonY + 40;

    const card = this.add.image(width / 2, cardY, 'hubMapPreviewCard').setOrigin(0.5, 0);
    // Crop a horizontal band out of the square source so it reads as a
    // wide map strip instead of a squished square.
    card.setCrop(0, 218, 700, 263);
    card.setDisplaySize(cardW, cardH);
    const frameBorder = this.add.graphics();
    frameBorder.lineStyle(3, 0x8b6b3d, 1);
    frameBorder.strokeRoundedRect(cardX, cardY, cardW, cardH, 10);

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

    // Decorative letter-block strip under the map preview - purely for
    // flavor, not interactive, no idle animation.
    const blocks = this.add.image(width / 2, this.mapPreviewBottom + 26, 'hubLetterBlocks');
    blocks.setDisplaySize(width * 0.5, (width * 0.5) * (300 / 900));
  }

  // --- Side icon columns ---------------------------------------------------

  createIconColumn(side, x) {
    // Spin-wheel icon removed per chat - not needed.
    const icons = side === 'left'
      ? ['iconShop', 'iconGallery', 'iconTrophy', 'iconLeaderboard']
      : ['iconCoinShop', 'iconCalendar', 'iconVideo'];

    const top = 90;
    const gap = 78;
    icons.forEach((key, i) => this.createColumnIcon(x, top + i * gap, key));
  }

  createColumnIcon(x, y, textureKey) {
    const size = 52;
    const cx = x + size / 2;
    const cy = y + size / 2;

    // No backing card and no idle animation - icons sit directly on the
    // forest background. Tap just does a press-down/up bounce; these
    // systems don't exist yet so there's nothing further to trigger.
    const icon = this.add.image(cx, cy, textureKey);
    icon.setDisplaySize(42, 42);
    // setDisplaySize gives this image a non-1 base scale (native art is
    // 280x280, shown at 42x42, so baseScale ~= 0.15). The tap-bounce
    // tween below must scale *relative to that*, not set scale to a
    // literal 0.88 - doing that was the bug that made icons balloon up
    // to ~6x size on every tap (0.88 absolute vs ~0.15 base), which is
    // the "icon pops out" the person flagged.
    const baseScale = icon.scale;

    const hit = this.add.rectangle(x, y, size, size, 0xffffff, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.tweens.add({ targets: icon, scale: baseScale * 0.88, duration: 70 }));
    hit.on('pointerup', () => this.tweens.add({ targets: icon, scale: baseScale, duration: 100 }));
  }

  // --- Bottom: the real navigation forward ----------------------------------

  createWordMapButton(width, height) {
    const w = width * 0.7;
    const x = width / 2;
    const y = height - 44;

    // Real art with "Word Map" already baked in, replacing the
    // code-drawn blue rect + text label - image is the whole button now.
    const button = this.add.image(x, y, 'hubWordMapButton');
    button.setDisplaySize(w, w * (button.height / button.width));
    const baseScale = button.scale;

    const hit = this.add.rectangle(x, y, button.displayWidth, button.displayHeight, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.tweens.add({ targets: button, scale: baseScale * 0.96, duration: 70 });
    });
    hit.on('pointerup', () => {
      this.tweens.add({
        targets: button,
        scale: baseScale,
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
