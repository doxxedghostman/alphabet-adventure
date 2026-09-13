import Phaser from 'phaser';
import { APP_BG_COLOR } from '../config.js';
import pkg from '../../package.json';
import { resetProgress } from '../utils/progressStore.js';
import { isMusicOn, isSfxOn, isHapticsOn, setMusicOn, setSfxOn, setHapticsOn } from '../utils/settingsStore.js';
import { isSignedIn, getDisplayName, getAvatarUrl, signInWithGoogle, signOut, onAuthChange } from '../utils/authStore.js';

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
// Section collapse state (per chat): each section (Account, Audio,
// etc.) starts collapsed and expands on tap. Kept at module scope
// (not on the scene instance) so it survives the scene.restart()
// calls that already happen on auth changes and on toggling a
// section itself - otherwise every restart would snap everything
// back to collapsed. Resets to all-collapsed on a fresh app load,
// which is fine for a settings screen.
const sectionCollapsed = {};
//
// Panel art (per chat: match the game's wood/nature style instead of
// flat colored boxes). Manual 3-slice (fixed left/right cap images +
// a stretchable middle strip) rather than Phaser's built-in NineSlice
// object - NineSlice is WebGL-only as of Phaser 3.60, which is a risk
// on older Android WebViews that might fall back to Canvas. Plain
// Image objects with setDisplaySize() work identically on both
// renderers. Wood is used for section headers (structural chrome,
// matches top-bar.png elsewhere); parchment is used for individual
// rows (a lighter, readable content surface).
const PANEL_TEXTURES = {
  wood: { left: 'settingsWoodCapLeft', mid: 'settingsWoodMiddle', right: 'settingsWoodCapRight' },
  parchment: { left: 'settingsParchmentCapLeft', mid: 'settingsParchmentMiddle', right: 'settingsParchmentCapRight' },
};
//
// Text palette for the two panel surfaces - dark warm brown reads on
// both the mid-tone wood and the light parchment, unlike the old
// white-on-purple palette which doesn't work on a light background.
const WOOD_TEXT = '#fff3d6';
const WOOD_TEXT_STROKE = '#3a2411';
const INK = '#3a2411';
const INK_MUTED = '#8a6a4a';
const INK_DISABLED = '#a89880';
const LINK_ACCENT = '#a8460f';
//
// Audio toggles (per chat): Music/SFX/Vibration are real, persisted
// switches now (see settingsStore.js) — but there is still no audio
// system in the codebase (no this.sound usage anywhere) and no
// @capacitor/haptics dependency installed, so flipping these currently
// changes only the stored preference, not any actual sound/vibration.
// Whatever adds real audio/haptics later just needs to check
// isMusicOn()/isSfxOn()/isHapticsOn() before playing anything.
//
// Status per section (update as each lands):
//   Account         - real: Sign in with Google / guest+synced messaging / Sign Out
//   Audio           - real toggles, persisted, not yet wired to actual sound/haptics (none exist)
//   Notifications   - placeholder (explicitly deferred per chat)
//   Support & Legal - Privacy/Terms/Contact real (placeholder destinations); Rate/Restore still placeholder
//   Data            - Reset Progress and Sign Out are both real
//   About           - real (live app version from package.json)
export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  preload() {
    // Loaded here (not create()) since preload() is the correct place
    // for asset loads - getAvatarUrl() is safe to call this early
    // because authStore's initAuth() already ran at app boot in
    // main.js, well before anyone could navigate here.
    const avatarUrl = getAvatarUrl();
    if (avatarUrl) {
      this.load.image('userAvatarSettings', avatarUrl);
    }

    this.load.image('settingsWoodCapLeft', 'assets/wood-cap-left.png');
    this.load.image('settingsWoodCapRight', 'assets/wood-cap-right.png');
    this.load.image('settingsWoodMiddle', 'assets/wood-middle.png');
    this.load.image('settingsParchmentCapLeft', 'assets/parchment-cap-left.png');
    this.load.image('settingsParchmentCapRight', 'assets/parchment-cap-right.png');
    this.load.image('settingsParchmentMiddle', 'assets/parchment-middle.png');
  }

  create() {
    const { width, height } = this.scale;
    this.hudHeight = 56;
    this.rowHeight = 46;
    this.sectionGap = 14;
    this.margin = 16;

    this.rows = [];
    this.confirmingReset = false;

    // Re-render the whole scene on any sign-in/sign-out while it's
    // open, rather than hand-maintaining which specific rows need to
    // change - simplest correct approach given how few rows actually
    // depend on auth state. Unsubscribe on shutdown so this doesn't
    // pile up a listener per visit.
    this._unsubscribeAuth = onAuthChange(() => {
      if (this.scene.isActive()) this.scene.restart();
    });
    this.events.once('shutdown', () => this._unsubscribeAuth());

    let y = this.hudHeight + 16;

    y = this.addCollapsibleSection(y, 'account', 'Account', (y) => this.addAccountRows(y));

    y = this.addCollapsibleSection(y, 'audio', 'Audio', (y) => {
      y = this.addToggleRow(y, 'Music', isMusicOn(), (value) => setMusicOn(value));
      y = this.addToggleRow(y, 'Sound effects', isSfxOn(), (value) => setSfxOn(value));
      y = this.addToggleRow(y, 'Vibration', isHapticsOn(), (value) => setHapticsOn(value));
      return y;
    });

    y = this.addCollapsibleSection(y, 'notifications', 'Notifications', (y) => {
      y = this.addPlaceholderRow(y, 'Daily reward reminder', 'Coming soon');
      y = this.addPlaceholderRow(y, 'Energy full reminder', 'Coming soon');
      y = this.addPlaceholderRow(y, 'Allow notifications', 'Coming soon');
      return y;
    });

    y = this.addCollapsibleSection(y, 'support', 'Support & Legal', (y) => {
      y = this.addLinkRow(y, 'Privacy Policy', PLACEHOLDER_PRIVACY_URL);
      y = this.addLinkRow(y, 'Terms of Service', PLACEHOLDER_TERMS_URL);
      y = this.addLinkRow(y, 'Contact Support', `mailto:${SUPPORT_EMAIL}`);
      y = this.addPlaceholderRow(y, 'Rate the App', 'Coming soon');
      y = this.addPlaceholderRow(y, 'Restore Purchases', 'Coming soon');
      return y;
    });

    y = this.addCollapsibleSection(y, 'data', 'Data', (y) => {
      y = this.addResetProgressRow(y);
      y = this.addSignOutRow(y);
      return y;
    });

    y = this.addCollapsibleSection(y, 'about', 'About', (y) => {
      y = this.addStaticRow(y, 'Version', pkg.version);
      y = this.addStaticRow(y, 'Credits', 'Wobblewing Studios');
      return y;
    });

    this.contentHeight = y + this.margin;
    this.setupDragScroll(height);
    this.createHud(width);
  }

  // --- Panel art (manual 3-slice: fixed caps + stretchable middle) -----

  // Builds a wood or parchment panel spanning (x, x+w) at vertical
  // center y, height h. Returns an invisible interactive Rectangle
  // (`hit`) sized to match - all row/header interaction (setInteractive,
  // .on('pointerup', ...), wasDrag()) wires up against `hit` exactly
  // like the old plain-Rectangle backgrounds did. `hit.setTintPanel()` /
  // `clearTintPanel()` / `setPanelAlpha()` recolor or fade the visible
  // art underneath for state (e.g. the green sign-in row, the muted
  // "coming soon" rows) without needing a flat fill color.
  createPanel(x, y, w, h, style) {
    const tex = PANEL_TEXTURES[style];

    const left = this.add.image(0, 0, tex.left);
    const right = this.add.image(0, 0, tex.right);
    const mid = this.add.image(0, 0, tex.mid);

    const capScale = h / left.height;
    left.setScale(capScale);
    right.setScale(capScale);
    const capW = left.displayWidth;

    const midW = Math.max(1, w - capW - right.displayWidth);
    mid.setDisplaySize(midW, h);

    left.setOrigin(0, 0.5).setPosition(x, y);
    mid.setOrigin(0, 0.5).setPosition(x + capW, y);
    right.setOrigin(1, 0.5).setPosition(x + w, y);

    const hit = this.add.rectangle(x, y, w, h, 0xffffff, 0);
    hit.setOrigin(0, 0.5);

    const images = [left, mid, right];
    hit.setTintPanel = (color) => images.forEach((img) => img.setTint(color));
    hit.clearTintPanel = () => images.forEach((img) => img.clearTint());
    hit.setPanelAlpha = (alpha) => images.forEach((img) => img.setAlpha(alpha));

    return hit;
  }

  // --- Row builders ----------------------------------------------------

  // Collapsible section header (per chat: bigger/bolder header text on
  // a real wood-panel background, sub-rows collapsed until tapped).
  // `rowBuilder(y)` is only called when the section is expanded, so
  // collapsed sections don't pay for rows they're not showing - it
  // must return the y position after whatever it added, same contract
  // as the individual row builders.
  addCollapsibleSection(y, key, label, rowBuilder) {
    const { width } = this.scale;
    const collapsed = sectionCollapsed[key] ?? true;
    const headerHeight = 44;

    const bg = this.createPanel(this.margin, y, width - this.margin * 2, headerHeight, 'wood');
    bg.setInteractive({ useHandCursor: true });

    const labelText = this.add.text(this.margin + 14, y, label.toUpperCase(), {
      fontFamily: 'Arial',
      fontSize: '19px',
      fontStyle: 'bold',
      color: WOOD_TEXT,
      stroke: WOOD_TEXT_STROKE,
      strokeThickness: 3,
    });
    labelText.setOrigin(0, 0.5);

    const chevron = this.add.text(width - this.margin - 14, y, collapsed ? '\u25B8' : '\u25BE', {
      fontFamily: 'Arial',
      fontSize: '20px',
      fontStyle: 'bold',
      color: WOOD_TEXT,
      stroke: WOOD_TEXT_STROKE,
      strokeThickness: 3,
    });
    chevron.setOrigin(1, 0.5);

    bg.on('pointerup', () => {
      if (this.wasDrag()) return;
      sectionCollapsed[key] = !collapsed;
      this.scene.restart();
    });

    y += headerHeight + 10;

    if (!collapsed) {
      y = rowBuilder(y);
    }

    return y + this.sectionGap;
  }

  rowBackground(y) {
    const { width } = this.scale;
    return this.createPanel(this.margin, y, width - this.margin * 2, this.rowHeight - 6, 'parchment');
  }

  // Renders either the signed-out state (Sign in with Google + a guest
  // status line) or the signed-in state (avatar/name + a synced status
  // line), depending on authStore's current state at the moment this
  // scene was (re)built - see the onAuthChange->scene.restart() wiring
  // in create() for how this stays current while the scene is open.
  addAccountRows(y) {
    if (isSignedIn()) {
      y = this.addSignedInRow(y);
      y = this.addStaticRow(y, 'Status', 'Data is synced');
      return y;
    }

    y = this.addSignInRow(y);
    y = this.addStaticRow(y, 'Status', 'Playing as guest');
    return y;
  }

  addSignInRow(y) {
    const bg = this.rowBackground(y);
    bg.setTintPanel(0x9adf8f);
    bg.setInteractive({ useHandCursor: true });

    const labelText = this.add.text(this.margin + 14, y, 'Sign in with Google', {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#1f4a1f',
    });
    labelText.setOrigin(0, 0.5);

    bg.on('pointerup', () => {
      if (this.wasDrag()) return;
      labelText.setText('Opening Google...');
      signInWithGoogle();
    });

    return y + this.rowHeight;
  }

  addSignedInRow(y) {
    const bg = this.rowBackground(y);
    const displayName = getDisplayName() || 'Signed in';

    const avatarX = this.margin + 26;
    if (this.textures.exists('userAvatarSettings')) {
      const avatar = this.add.image(avatarX, y, 'userAvatarSettings');
      avatar.setDisplaySize(32, 32);
      const mask = this.add.circle(avatarX, y, 16, 0xffffff).setVisible(false);
      avatar.setMask(mask.createGeometryMask());
    } else {
      this.add.circle(avatarX, y, 16, 0x8f5c3c, 1).setStrokeStyle(1, 0x3a2411, 0.8);
    }

    const labelText = this.add.text(this.margin + 48, y, displayName, {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: INK,
    });
    labelText.setOrigin(0, 0.5);

    return y + this.rowHeight;
  }

  addPlaceholderRow(y, label, note) {
    const bg = this.rowBackground(y);
    bg.setPanelAlpha(0.5);

    const labelText = this.add.text(this.margin + 14, y, label, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: INK_DISABLED,
    });
    labelText.setOrigin(0, 0.5);

    const noteText = this.add.text(this.scale.width - this.margin - 14, y, note, {
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'italic',
      color: INK_DISABLED,
    });
    noteText.setOrigin(1, 0.5);

    return y + this.rowHeight;
  }

  addStaticRow(y, label, value) {
    this.rowBackground(y);

    const labelText = this.add.text(this.margin + 14, y, label, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: INK,
    });
    labelText.setOrigin(0, 0.5);

    const valueText = this.add.text(this.scale.width - this.margin - 14, y, value, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: INK_MUTED,
    });
    valueText.setOrigin(1, 0.5);

    return y + this.rowHeight;
  }

  addToggleRow(y, label, initialValue, onChange) {
    const bg = this.rowBackground(y);
    bg.setInteractive({ useHandCursor: true });

    const labelText = this.add.text(this.margin + 14, y, label, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: INK,
    });
    labelText.setOrigin(0, 0.5);

    const trackWidth = 44;
    const trackHeight = 24;
    const trackX = this.scale.width - this.margin - 14 - trackWidth / 2;
    const onColor = 0x4caf50;
    const offColor = 0x8a7658;

    const track = this.add.rectangle(trackX, y, trackWidth, trackHeight, initialValue ? onColor : offColor, 1);
    track.setStrokeStyle(1, 0x3a2411, 0.4);

    const knobOffset = trackWidth / 2 - trackHeight / 2;
    const knob = this.add.circle(trackX + (initialValue ? knobOffset : -knobOffset), y, trackHeight / 2 - 3, 0xffffff, 1);

    let value = initialValue;
    bg.on('pointerup', () => {
      if (this.wasDrag()) return;
      value = !value;
      onChange(value);
      track.setFillStyle(value ? onColor : offColor);
      this.tweens.add({
        targets: knob,
        x: trackX + (value ? knobOffset : -knobOffset),
        duration: 120,
        ease: 'Sine.easeOut',
      });
    });

    return y + this.rowHeight;
  }

  addLinkRow(y, label, url) {
    const bg = this.rowBackground(y);
    bg.setInteractive({ useHandCursor: true });

    const labelText = this.add.text(this.margin + 14, y, label, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: INK,
    });
    labelText.setOrigin(0, 0.5);

    const chevron = this.add.text(this.scale.width - this.margin - 14, y, '\u2192', {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: LINK_ACCENT,
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
    bg.setTintPanel(0xe6a89c);
    bg.setInteractive({ useHandCursor: true });

    const labelText = this.add.text(this.margin + 14, y, 'Reset Progress', {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#5c1414',
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

  // Only rendered while signed in (addAccountRows/create() decide
  // that) - signing out is meaningless for a guest with no session.
  addSignOutRow(y) {
    const bg = this.rowBackground(y);

    const labelText = this.add.text(this.margin + 14, y, 'Sign Out', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: isSignedIn() ? INK : INK_DISABLED,
    });
    labelText.setOrigin(0, 0.5);

    if (!isSignedIn()) {
      bg.setPanelAlpha(0.5);
      const note = this.add.text(this.scale.width - this.margin - 14, y, 'Not signed in', {
        fontFamily: 'Arial',
        fontSize: '13px',
        fontStyle: 'italic',
        color: INK_DISABLED,
      });
      note.setOrigin(1, 0.5);
      return y + this.rowHeight;
    }

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerup', () => {
      if (this.wasDrag()) return;
      signOut();
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
    const bar = this.add.rectangle(0, 0, width, this.hudHeight, APP_BG_COLOR, 0.95).setOrigin(0);
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
