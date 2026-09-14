import Phaser from 'phaser';
import { APP_BG_COLOR_RGB } from '../config.js';
import { WORLDS } from '../data/worlds.js';
import { isWorldUnlocked } from '../utils/progressStore.js';

// World Map entry screen (PLAN.md §8.5).
//
// Per chat: the previous version baked the whole screen (title, all 10
// card frames/nameplates/gems, back arrow) into one flat composite
// image. That looked right on the mockup's own aspect ratio, but
// couldn't adapt to the fixed game canvas - scaled to fit width it
// left a large empty gap below the content on taller screens, and
// scaling further to fill that gap would crop real card content off
// the left/right edges, not just decorative margin.
//
// Back to a procedural 2-column grid (like the pre-mockup version, and
// like HomeHubScene's icon grid) so it fills whatever height the
// screen has and scrolls for the rest - genuinely responsive, rather
// than one fixed-aspect image. The forest background is reused from
// HomeHubScene and cover-scaled behind everything (safe to crop, it's
// pure decoration, same treatment as the Home Hub). Each tile keeps
// the original per-world thumbnail art and adds a gold double-frame,
// a wood nameplate, and a tinted gem (per-world gemColor in
// worlds.js) drawn in code rather than cropped from the mockup -
// avoids relying on fragile pixel-extraction of a transparent frame
// out of a busy illustration. If a pixel-identical ornate frame/
// nameplate asset (transparent background, generated clean rather
// than cropped) becomes available later, it can drop into
// drawTile() in place of the Graphics-drawn frame without touching
// the grid/scroll logic.
export class WorldSelectScene extends Phaser.Scene {
  constructor() {
    super('WorldSelectScene');
  }

  preload() {
    this.load.image('hubForestBg', 'assets/forest-background.jpg');
    this.load.image('icon-back', 'assets/icon-back.png');
    WORLDS.forEach((w) => this.load.image(w.thumbKey, w.thumbPath));
  }

  create() {
    const { width, height } = this.scale;
    this.hudHeight = 64;

    this.createBackground(width, height);
    this.layoutGrid(width);
    this.drawTiles();
    this.setupDragScroll(height);
    this.createHud(width);
  }

  createBackground(width, height) {
    // Cover-scale + center, same as HomeHubScene.createBackground - pure
    // decoration behind the scrollable grid, fixed to the camera so it
    // doesn't move as the grid scrolls.
    const bg = this.add.image(width / 2, height / 2, 'hubForestBg');
    const scale = Math.max(width / bg.width, height / bg.height);
    bg.setScale(scale);
    bg.setScrollFactor(0);
    this.add.rectangle(0, 0, width, height, 0x1a1030, 0.15).setOrigin(0).setScrollFactor(0);
  }

  layoutGrid(width) {
    const margin = 16;
    const gap = 14;
    const columns = 2;
    this.tileWidth = (width - margin * 2 - gap * (columns - 1)) / columns;
    this.tileHeight = this.tileWidth * (360 / 480); // matches thumb aspect
    this.nameplateHeight = 34;
    this.gemRadius = 9;
    this.labelHeight = this.nameplateHeight * 0.7 + this.gemRadius * 2 + 6;
    this.rowHeight = this.tileHeight + this.labelHeight + gap;
    this.margin = margin;
    this.gap = gap;
    this.contentTop = this.hudHeight + margin;

    const rows = Math.ceil(WORLDS.length / columns);
    this.contentHeight = this.contentTop + rows * this.rowHeight + margin;
  }

  drawTiles() {
    const columns = 2;
    WORLDS.forEach((world, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = this.margin + col * (this.tileWidth + this.gap);
      const y = this.contentTop + row * this.rowHeight;
      this.drawTile(world, x, y);
    });
  }

  drawTile(world, x, y) {
    const unlocked = isWorldUnlocked(world.id);
    const cx = x + this.tileWidth / 2;

    const thumb = this.add.image(x, y, world.thumbKey).setOrigin(0);
    thumb.setDisplaySize(this.tileWidth, this.tileHeight);

    // Ornate-ish double frame: thick gold outer stroke, thinner bronze
    // inner stroke just inside it - a code-drawn stand-in for the
    // mockup's carved gold frame art.
    const frame = this.add.graphics();
    frame.lineStyle(5, 0xf6c94a, 1);
    frame.strokeRoundedRect(x, y, this.tileWidth, this.tileHeight, 14);
    frame.lineStyle(2, 0x8a5a1e, 0.9);
    frame.strokeRoundedRect(x + 3, y + 3, this.tileWidth - 6, this.tileHeight - 6, 11);

    // Nameplate: wood-brown pill overlapping the tile's bottom edge.
    const plateY = y + this.tileHeight;
    const plateWidth = this.tileWidth * 0.86;
    const plate = this.add.graphics();
    plate.fillStyle(0x6b3f1d, 1);
    plate.fillRoundedRect(cx - plateWidth / 2, plateY - this.nameplateHeight / 2, plateWidth, this.nameplateHeight, this.nameplateHeight / 2);
    plate.lineStyle(2.5, 0xf6c94a, 1);
    plate.strokeRoundedRect(cx - plateWidth / 2, plateY - this.nameplateHeight / 2, plateWidth, this.nameplateHeight, this.nameplateHeight / 2);

    const label = this.add.text(cx, plateY, world.name, {
      fontFamily: 'Arial Black, Arial',
      fontSize: '13px',
      color: unlocked ? '#ffe9a8' : '#9a9a9a',
      stroke: '#4a2a0e',
      strokeThickness: 3,
      align: 'center',
      wordWrap: { width: plateWidth - 12 },
    });
    label.setOrigin(0.5);

    // Gem: small tinted diamond below the nameplate.
    const gemY = plateY + this.nameplateHeight / 2 + this.gemRadius + 4;
    const gem = this.add.graphics();
    const r = this.gemRadius;
    gem.fillStyle(unlocked ? world.gemColor : 0x8f8f9c, 1);
    gem.lineStyle(2, 0xf6c94a, 1);
    gem.beginPath();
    gem.moveTo(cx, gemY - r);
    gem.lineTo(cx + r, gemY);
    gem.lineTo(cx, gemY + r);
    gem.lineTo(cx - r, gemY);
    gem.closePath();
    gem.fillPath();
    gem.strokePath();

    if (!unlocked) {
      thumb.setTint(0x555555);
      const overlay = this.add.graphics();
      overlay.fillStyle(0x000000, 0.35);
      overlay.fillRoundedRect(x, y, this.tileWidth, this.tileHeight, 14);
      this.drawLockIcon(cx, y + this.tileHeight / 2);
      return;
    }

    const hitArea = this.add
      .rectangle(x, y, this.tileWidth, this.tileHeight, 0xffffff, 0)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    hitArea.on('pointerup', () => {
      if (this.wasDrag()) return;
      this.selectWorld(world.id);
    });
  }

  drawLockIcon(x, y) {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.95);
    g.fillRoundedRect(x - 13, y - 3, 26, 20, 4);
    g.lineStyle(4, 0xffffff, 0.95);
    g.beginPath();
    g.arc(x, y - 5, 10, Math.PI, 0, false);
    g.strokePath();
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

  // --- HUD + navigation -----------------------------------------------------

  createHud(width) {
    const barHeight = this.hudHeight;
    const bar = this.add.graphics().setScrollFactor(0);
    bar.fillStyle(0x2b1a0e, 0.55);
    bar.fillRect(0, 0, width, barHeight);

    const title = this.add.text(width / 2, barHeight / 2, 'World Map', {
      fontFamily: 'Arial Black, Arial',
      fontSize: '24px',
      color: '#ffe9a8',
      stroke: '#4a2a0e',
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 3, fill: true },
    });
    title.setOrigin(0.5);
    title.setScrollFactor(0);

    const backButton = this.add
      .image(36, barHeight / 2, 'icon-back')
      .setDisplaySize(44, 44)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

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
