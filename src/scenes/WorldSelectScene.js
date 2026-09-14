import Phaser from 'phaser';
import { APP_BG_COLOR_RGB } from '../config.js';
import { WORLDS } from '../data/worlds.js';
import { isWorldUnlocked } from '../utils/progressStore.js';

// World Map entry screen (PLAN.md §8.5). Per chat: rather than
// code-drawing each tile (frame/label/lock) piece by piece, the whole
// screen is one baked illustration (world-map-bg.jpg, includes the
// title banner, all 10 card frames + nameplates + gems, and a back
// arrow already painted in) with invisible tap zones laid over the
// card positions. Card positions are read off a uniform 2-column,
// 5-row grid measured as fractions of the source art's 1024x1536
// canvas (BG_W/BG_H below) - same "derive on-screen position from
// native art coordinates x runtime scale" approach worlds.js/
// HomeHubScene already use, rather than hardcoding screen-space
// numbers that would drift if the art or bar width changed.
//
// The back button is the one interactive piece NOT left baked into
// the art: it's the existing icon-back texture (already used by
// CalendarScene, same round gem-ringed arrow design as the one
// painted into the composite) laid on top with scrollFactor(0), so it
// stays tappable and visible even if a screen is short enough to need
// scrolling. Everything else scrolls together as part of the single
// background image.
//
// Locked-world dimming/padlock was dropped along with the old
// code-drawn tiles: isWorldUnlocked() currently always returns true
// (see progressStore.js), so there's nothing to dim right now. If
// that lock logic is ever re-enabled, this screen will need its own
// pass again (the baked art has no "locked" state to fall back to).

const BG_W = 1024;
const BG_H = 1536;

// Card grid, measured as fractions of BG_W/BG_H from the source art.
// Close estimates from the mockup, not pixel-perfect - nudge these if
// tap zones feel off once you see it live.
const ROW_TOP_FRAC = [0.105, 0.255, 0.405, 0.555, 0.705];
const ROW_HEIGHT_FRAC = 0.135;
const COL_LEFT_FRAC = [0.03, 0.525];
const COL_WIDTH_FRAC = 0.445;

// Back arrow as painted into the composite - the interactive icon-back
// sprite is laid directly on top of this spot.
const BACK_CENTER_X_FRAC = 0.063;
const BACK_CENTER_Y_FRAC = 0.048;
const BACK_DIAMETER_FRAC = 0.095;

export class WorldSelectScene extends Phaser.Scene {
  constructor() {
    super('WorldSelectScene');
  }

  preload() {
    this.load.image('world-map-bg', 'assets/world-map-bg.jpg');
    this.load.image('icon-back', 'assets/icon-back.png');
  }

  create() {
    const { width, height } = this.scale;
    this.scale_ = width / BG_W;
    this.bgDisplayHeight = BG_H * this.scale_;

    this.add.image(0, 0, 'world-map-bg').setOrigin(0).setDisplaySize(width, this.bgDisplayHeight);

    this.contentHeight = this.bgDisplayHeight;
    this.setupDragScroll(height);
    this.drawTapZones();
    this.createBackButton();
  }

  drawTapZones() {
    const columns = 2;
    WORLDS.forEach((world, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = COL_LEFT_FRAC[col] * BG_W * this.scale_;
      const y = ROW_TOP_FRAC[row] * BG_H * this.scale_;
      const w = COL_WIDTH_FRAC * BG_W * this.scale_;
      const h = ROW_HEIGHT_FRAC * BG_H * this.scale_;
      this.drawTapZone(world, x, y, w, h);
    });
  }

  drawTapZone(world, x, y, w, h) {
    const unlocked = isWorldUnlocked(world.id);
    if (!unlocked) return; // no baked "locked" art to fall back to right now

    const hitArea = this.add
      .rectangle(x, y, w, h, 0xffffff, 0)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    hitArea.on('pointerup', () => {
      if (this.wasDrag()) return;
      this.selectWorld(world.id);
    });
  }

  // --- Drag-to-scroll (same pattern as LevelPathScene) --------------------

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

    // Desktop testing/playing: drag-to-scroll alone misses the natural
    // instinct of reaching for the scroll wheel / trackpad. Same clamp
    // math as the drag handler above.
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const maxScroll = Math.max(0, this.contentHeight - viewportHeight);
      this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY + deltaY, 0, maxScroll);
    });
  }

  wasDrag() {
    return this.dragDistance > 12;
  }

  // --- Back button -----------------------------------------------------

  createBackButton() {
    const x = BACK_CENTER_X_FRAC * BG_W * this.scale_;
    const y = BACK_CENTER_Y_FRAC * BG_H * this.scale_;
    const diameter = BACK_DIAMETER_FRAC * BG_W * this.scale_;

    const backButton = this.add.image(x, y, 'icon-back').setScrollFactor(0).setInteractive({ useHandCursor: true });
    backButton.setDisplaySize(diameter, diameter);

    backButton.on('pointerup', () => {
      if (this.wasDrag()) return;
      this.cameras.main.fadeOut(220, ...APP_BG_COLOR_RGB);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('HomeHubScene');
      });
    });
  }

  selectWorld(worldId) {
    this.cameras.main.fadeOut(220, ...APP_BG_COLOR_RGB);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('LevelPathScene', { worldId });
    });
  }
}
