import Phaser from 'phaser';
import pkg from '../../package.json';
import { resetProgress } from '../utils/progressStore.js';

// Settings — was a small fixed-height popup inside HomeHubScene with
// exactly two buttons (Reset Progress, Close). That doesn't scale to a
// real settings list (Account, Audio, Notifications, Support/Legal,
// Data, About), so this replaces it with its own scrollable scene,
// same drag-to-scroll + fixed HUD pattern as WorldSelectScene /
// LevelPathScene.
//
// Being filled in one section at a time (per chat). Sections below are
// scaffolded in full so the whole settings surface exists and is
// navigable now; a row is only made interactive/functional in the
// commit that actually builds it. Anything not yet wired renders as a
// visibly-disabled "Coming soon" row rather than being omitted, so
// nothing looks missing while it's still pending.
//
// Support & Legal links (per chat): Privacy Policy / Terms of Service
// point at placeholder URLs — nothing real published yet, swap
// PLACEHOLDER_PRIVACY_URL / PLACEHOLDER_TERMS_URL once they exist.
// Contact Support opens a mailto: to wordswoop@gmail.com — per chat
// this should really be a studio-level address rather than a
// per-game one, but that hasn't been created yet, so this is a
// placeholder to swap once it is. Rate the App and Restore Purchases
// stay as "Coming soon" placeholders (no store listing yet, no IAP
// wired up yet) rather than half-real links to nothing.
const PLACEHOLDER_PRIVACY_URL = 'https://example.com/wordswoop/privacy';
const PLACEHOLDER_TERMS_URL = 'https://example.com/wordswoop/terms';
const SUPPORT_EMAIL = 'wordswoop@gmail.com';
//
// Status per section (update as each lands):
//   Account         - placeholder (blocked on Google sign-in / Supabase decision)
//   Audio           - placeholder
//   Notifications   - placeholder (explicitly deferred per chat)
//   Support & Legal - Privacy/Terms/Contact real (placeholder destinations); Rate/Restore still placeholder
//   Data            - Reset Progress is real; Sign Out placeholder (blocked with Account)
//   About           - real (live app version from package.json)
export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  create() {
    const { width, height } = this.scale;
    this.hudHeight = 56;
    this.rowHeight = 46;
    this.sectionGap = 14;
    this.margin = 16;

    this.rows = [];
    this.confirmingReset = false;

    let y = this.hudHeight + 16;
    y = this.addSection(y, 'Account');
    y = this.addPlaceholderRow(y, 'Sign in with Google', 'Coming soon');
    y = this.addPlaceholderRow(y, 'Display name & avatar', 'Coming soon');
    y = this.addPlaceholderRow(y, 'Playing as guest', 'Sign in to save progress');
    y += this.sectionGap;

    y = this.addSection(y, 'Audio');
    y = this.addPlaceholderRow(y, 'Music', 'Coming soon');
    y = this.addPlaceholderRow(y, 'Sound effects', 'Coming soon');
    y = this.addPlaceholderRow(y, 'Vibration', 'Coming soon');
    y += this.sectionGap;

    y = this.addSection(y, 'Notifications');
    y = this.addPlaceholderRow(y, 'Daily reward reminder', 'Coming soon');
    y = this.addPlaceholderRow(y, 'Energy full reminder', 'Coming soon');
    y = this.addPlaceholderRow(y, 'Allow notifications', 'Coming soon');
    y += this.sectionGap;

    y = this.addSection(y, 'Support & Legal');
    y = this.addLinkRow(y, 'Privacy Policy', PLACEHOLDER_PRIVACY_URL);
    y = this.addLinkRow(y, 'Terms of Service', PLACEHOLDER_TERMS_URL);
    y = this.addLinkRow(y, 'Contact Support', `mailto:${SUPPORT_EMAIL}`);
    y = this.addPlaceholderRow(y, 'Rate the App', 'Coming soon');
    y = this.addPlaceholderRow(y, 'Restore Purchases', 'Coming soon');
    y += this.sectionGap;

    y = this.addSection(y, 'Data');
    y = this.addResetProgressRow(y);
    y = this.addPlaceholderRow(y, 'Sign Out', 'Coming soon');
    y += this.sectionGap;

    y = this.addSection(y, 'About');
    y = this.addStaticRow(y, 'Version', pkg.version);
    y = this.addStaticRow(y, 'Credits', 'Wobblewing Studios');
    y += this.sectionGap;

    this.contentHeight = y + this.margin;
    this.setupDragScroll(height);
    this.createHud(width);
  }

  // --- Row builders ----------------------------------------------------

  addSection(y, label) {
    const text = this.add.text(this.margin, y, label.toUpperCase(), {
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffd93d',
    });
    text.setOrigin(0, 0.5);
    return y + 26;
  }

  rowBackground(y) {
    const { width } = this.scale;
    const bg = this.add.rectangle(this.margin, y, width - this.margin * 2, this.rowHeight - 6, 0x2f2350, 1);
    bg.setOrigin(0, 0.5);
    bg.setStrokeStyle(1, 0xffffff, 0.12);
    return bg;
  }

  addPlaceholderRow(y, label, note) {
    const bg = this.rowBackground(y);
    bg.setFillStyle(0x241a3d, 1);

    const labelText = this.add.text(this.margin + 14, y, label, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#9a90b8',
    });
    labelText.setOrigin(0, 0.5);

    const noteText = this.add.text(this.scale.width - this.margin - 14, y, note, {
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'italic',
      color: '#77709a',
    });
    noteText.setOrigin(1, 0.5);

    return y + this.rowHeight;
  }

  addStaticRow(y, label, value) {
    const bg = this.rowBackground(y);

    const labelText = this.add.text(this.margin + 14, y, label, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#ffffff',
    });
    labelText.setOrigin(0, 0.5);

    const valueText = this.add.text(this.scale.width - this.margin - 14, y, value, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#c9c0e6',
    });
    valueText.setOrigin(1, 0.5);

    return y + this.rowHeight;
  }

  addLinkRow(y, label, url) {
    const bg = this.rowBackground(y);
    bg.setInteractive({ useHandCursor: true });

    const labelText = this.add.text(this.margin + 14, y, label, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#ffffff',
    });
    labelText.setOrigin(0, 0.5);

    const chevron = this.add.text(this.scale.width - this.margin - 14, y, '\u2192', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#ffd93d',
    });
    chevron.setOrigin(1, 0.5);

    bg.on('pointerup', () => {
      if (this.wasDrag()) return;
      window.open(url, '_blank', 'noopener');
    });

    return y + this.rowHeight;
  }

  addResetProgressRow(y) {
    const bg = this.rowBackground(y);
    bg.setFillStyle(0x4a1f22, 1);
    bg.setInteractive({ useHandCursor: true });

    const labelText = this.add.text(this.margin + 14, y, 'Reset Progress', {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    labelText.setOrigin(0, 0.5);

    bg.on('pointerup', () => {
      if (this.wasDrag()) return;
      if (this.confirmingReset) {
        resetProgress();
        this.scene.start('SettingsScene');
        return;
      }
      this.confirmingReset = true;
      labelText.setText('Tap again to confirm');
      this.tweens.add({ targets: [bg, labelText], scaleX: 1.02, duration: 90, yoyo: true, ease: 'Sine.easeOut' });
      this.time.delayedCall(2500, () => {
        this.confirmingReset = false;
        if (labelText.active) labelText.setText('Reset Progress');
      });
    });

    return y + this.rowHeight;
  }

  // --- Drag-to-scroll (same pattern as WorldSelectScene/LevelPathScene) ----

  setupDragScroll(viewportHeight) {
    this.dragActive = false;
    this.dragStartY = 0;
    this.dragStartScroll = 0;
    this.dragDistance = 0;

    this.cameras.main.setBounds(0, 0, this.scale.width, Math.max(this.contentHeight, viewportHeight));

    this.input.on('pointerdown', (pointer) => {
      this.dragActive = true;
      this.dragStartY = pointer.y;
      this.dragStartScroll = this.cameras.main.scrollY;
      this.dragDistance = 0;
    });

    this.input.on('pointermove', (pointer) => {
      if (!this.dragActive || !pointer.isDown) return;
      const delta = pointer.y - this.dragStartY;
      this.dragDistance = Math.max(this.dragDistance, Math.abs(delta));
      const maxScroll = Math.max(0, this.contentHeight - viewportHeight);
      this.cameras.main.scrollY = Phaser.Math.Clamp(this.dragStartScroll - delta, 0, maxScroll);
    });

    this.input.on('pointerup', () => {
      this.dragActive = false;
    });

    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const maxScroll = Math.max(0, this.contentHeight - viewportHeight);
      this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY + deltaY, 0, maxScroll);
    });
  }

  wasDrag() {
    return this.dragDistance > 12;
  }

  // --- HUD + navigation -------------------------------------------------

  createHud(width) {
    const bar = this.add.rectangle(0, 0, width, this.hudHeight, 0x241a3d, 0.95).setOrigin(0);
    bar.setScrollFactor(0);

    const title = this.add.text(width / 2, this.hudHeight / 2, 'Settings', {
      fontFamily: 'Arial',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    title.setOrigin(0.5);
    title.setScrollFactor(0);

    const backButton = this.add
      .text(16, this.hudHeight / 2, '\u2190 Back', {
        fontFamily: 'Arial',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffd93d',
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    backButton.on('pointerup', () => {
      if (this.wasDrag()) return;
      this.scene.start('HomeHubScene');
    });
  }
}
