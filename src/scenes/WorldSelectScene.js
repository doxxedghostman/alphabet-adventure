import Phaser from 'phaser';
import { WORLDS } from '../data/worlds.js';
import { isWorldUnlocked } from '../utils/progressStore.js';

// World Map entry screen (PLAN.md §8.5): a 2-column grid of all 10
// world tiles, scrollable vertically since 5 rows don't fit the fixed
// canvas at once. Locked worlds show greyed-out with a padlock
// overlay (code-drawn, like LevelPathScene's lock icon) - only World 1
// is unlocked until its boss level is completed.
export class WorldSelectScene extends Phaser.Scene {
  constructor() {
    super('WorldSelectScene');
  }

  preload() {
    WORLDS.forEach((w) => this.load.image(w.thumbKey, w.thumbPath));
  }

  create() {
    const { width, height } = this.scale;
    this.hudHeight = 56;

    this.layoutGrid(width);
    this.drawTiles();
    this.setupDragScroll(height);
    this.createHud(width);
  }

  layoutGrid(width) {
    const margin = 16;
    const gap = 12;
    const columns = 2;
    this.tileWidth = (width - margin * 2 - gap * (columns - 1)) / columns;
    this.tileHeight = this.tileWidth * (360 / 480); // matches thumb aspect
    this.labelHeight = 28;
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

    const thumb = this.add.image(x, y, world.thumbKey).setOrigin(0);
    thumb.setDisplaySize(this.tileWidth, this.tileHeight);

    const frame = this.add.graphics();
    frame.lineStyle(3, 0xffffff, 0.9);
    frame.strokeRoundedRect(x, y, this.tileWidth, this.tileHeight, 10);

    const label = this.add.text(x + this.tileWidth / 2, y + this.tileHeight + this.labelHeight / 2, world.name, {
      fontFamily: 'Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      color: unlocked ? '#ffffff' : '#8f8f9c',
      align: 'center',
      wordWrap: { width: this.tileWidth },
    });
    label.setOrigin(0.5);

    if (!unlocked) {
      thumb.setTint(0x555555);
      const overlay = this.add.graphics();
      overlay.fillStyle(0x000000, 0.35);
      overlay.fillRoundedRect(x, y, this.tileWidth, this.tileHeight, 10);
      this.drawLockIcon(x + this.tileWidth / 2, y + this.tileHeight / 2);
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
    const bar = this.add.rectangle(0, 0, width, this.hudHeight, 0x241a3d, 0.85).setOrigin(0);
    bar.setScrollFactor(0);

    const title = this.add.text(width / 2, this.hudHeight / 2, 'World Map', {
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
      this.cameras.main.fadeOut(220, 0x24, 0x1a, 0x3d);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('HomeHubScene');
      });
    });
  }

  selectWorld(worldId) {
    this.cameras.main.fadeOut(220, 0x24, 0x1a, 0x3d);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('LevelPathScene', { worldId });
    });
  }
}
