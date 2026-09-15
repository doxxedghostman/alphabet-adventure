import Phaser from 'phaser';
import { APP_BG_COLOR, APP_BG_COLOR_RGB } from '../config.js';
import { getWorld } from '../data/worlds.js';
import { getPathNodes } from '../data/levelPaths.js';
import { levelIdFor, isLevelUnlocked, isLevelComplete, LEVELS_PER_WORLD } from '../utils/progressStore.js';

// Per-world node path (PLAN.md §8.5): a scrollable background with 20
// code-drawn nodes (lock icon / number / star depending on progress),
// node 1 (Start) at the bottom, node 20 (boss) at the top - path
// reads bottom-to-top.
//
// Per chat: we tried baking numbered medals + the path directly into
// the art (see git history around c0ea4c4/3418edc), but landed back
// here - the plain art scales to the canvas WIDTH only and scrolls
// vertically, so nothing is ever cropped left/right (unlike a "cover"
// scale, which was cropping the sides of that medal art). The
// original 600x900 art wasn't tall enough for that width-only scale
// on very tall phones though, leaving a flat-color gap below it once
// scrolled to the top - that's the "half the screen is empty tan" bug
// from the first screenshot in this thread. Fixed by vertically
// extending that same art to 600x1700 (comfortably taller than any
// supported device viewport - see config.js's height range) rather
// than cropping or stretching it.
//
// Nodes are still plain circles for now - per chat, real icon-button
// art is coming to replace them, at which point placeNode() is the
// place to swap the graphics.fillCircle/text calls for actual images.
export class LevelPathScene extends Phaser.Scene {
  constructor() {
    super('LevelPathScene');
  }

  init(sceneData) {
    this.worldId = sceneData?.worldId ?? 1;
    this.world = getWorld(this.worldId);
  }

  preload() {
    this.load.image(this.world.bgKey, this.world.bgPath);
  }

  create() {
    const { width, height } = this.scale;

    const bg = this.add.image(0, 0, this.world.bgKey).setOrigin(0);
    this.bgScale = width / (bg.width || this.world.pathSpace.width);
    bg.setScale(this.bgScale);
    this.bgDisplayHeight = bg.displayHeight;

    // Camera can scroll vertically over the full background height;
    // start scrolled to the bottom, where Level 1 / Start sits.
    this.cameras.main.setBounds(0, 0, width, this.bgDisplayHeight);
    this.cameras.main.scrollY = Math.max(0, this.bgDisplayHeight - height);

    this.setupDragScroll(height);
    this.drawPath();
    this.drawNodes();
    this.createHud();
  }

  // --- Drag-to-scroll -------------------------------------------------------

  setupDragScroll(viewportHeight) {
    this.dragActive = false;
    this.dragStartY = 0;
    this.dragStartScroll = 0;
    this.dragDistance = 0;

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
      const maxScroll = Math.max(0, this.bgDisplayHeight - viewportHeight);
      this.cameras.main.scrollY = Phaser.Math.Clamp(this.dragStartScroll - delta, 0, maxScroll);
    });

    this.input.on('pointerup', () => {
      this.dragActive = false;
    });

    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const maxScroll = Math.max(0, this.bgDisplayHeight - viewportHeight);
      this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY + deltaY, 0, maxScroll);
    });
  }

  // A node/back-button tap should be ignored if the pointer actually
  // dragged past a small threshold - otherwise every pan gesture would
  // also fire whatever node it started on.
  wasDrag() {
    return this.dragDistance > 12;
  }

  // --- Path + nodes -----------------------------------------------------

  drawPath() {
    const nodes = getPathNodes(this.worldId);
    const line = this.add.graphics();
    line.lineStyle(6, 0xffffff, 0.35);
    line.beginPath();
    nodes.forEach((n, i) => {
      const x = n.x * this.bgScale;
      const y = n.y * this.bgScale;
      if (i === 0) line.moveTo(x, y);
      else line.lineTo(x, y);
    });
    line.strokePath();
  }

  drawNodes() {
    const nodes = getPathNodes(this.worldId);
    nodes.forEach((n, i) => {
      const levelNum = i + 1;
      const x = n.x * this.bgScale;
      const y = n.y * this.bgScale;
      const isBoss = levelNum === LEVELS_PER_WORLD;
      const unlocked = isLevelUnlocked(this.worldId, levelNum);
      const complete = isLevelComplete(levelIdFor(this.worldId, levelNum));

      if (levelNum === 1) this.drawStartSignpost(x, y);
      this.placeNode(x, y, levelNum, { isBoss, unlocked, complete });
    });
  }

  drawStartSignpost(x, y) {
    const post = this.add.graphics();
    post.fillStyle(0x8b5a2b, 1);
    post.fillRect(x - 4, y - 62, 8, 34);
    post.fillStyle(0xffffff, 1);
    post.fillRoundedRect(x - 34, y - 82, 68, 26, 4);
    const label = this.add.text(x, y - 69, 'START', {
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#5a3921',
    });
    label.setOrigin(0.5);
  }

  placeNode(x, y, levelNum, { isBoss, unlocked, complete }) {
    const radius = isBoss ? 34 : 26;

    let fillColor = 0x8f8f9c; // locked
    if (complete) fillColor = 0xffc93c;
    else if (unlocked) fillColor = 0xff6fa5;

    const circle = this.add.graphics();
    if (isBoss) {
      circle.lineStyle(5, 0xffd700, 1);
      circle.strokeCircle(x, y, radius + 6);
    }
    circle.fillStyle(fillColor, 1);
    circle.fillCircle(x, y, radius);
    circle.lineStyle(3, 0xffffff, 0.9);
    circle.strokeCircle(x, y, radius);

    if (!unlocked) {
      this.drawLockIcon(x, y, radius * 1.4);
    } else if (complete) {
      this.add.text(x, y, '\u2605', { fontFamily: 'Arial', fontSize: `${radius}px`, color: '#ffffff' }).setOrigin(0.5);
    } else {
      this.add
        .text(x, y, String(levelNum), {
          fontFamily: 'Arial',
          fontSize: isBoss ? '24px' : '20px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5);
    }

    if (unlocked) {
      const hitArea = this.add.circle(x, y, radius + 8, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hitArea.on('pointerup', () => {
        if (this.wasDrag()) return;
        this.selectLevel(levelNum);
      });
    } else {
      const hitArea = this.add.circle(x, y, radius + 8, 0xffffff, 0).setInteractive({ useHandCursor: false });
      hitArea.on('pointerup', () => {
        if (this.wasDrag()) return;
        this.shakeLockedNode(circle, x);
      });
    }
  }

  drawLockIcon(x, y, radius) {
    const s = radius * 0.5;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.95);
    g.fillRoundedRect(x - s * 0.55, y - s * 0.1, s * 1.1, s * 0.85, s * 0.18);
    g.lineStyle(s * 0.18, 0xffffff, 0.95);
    g.beginPath();
    g.arc(x, y - s * 0.15, s * 0.42, Math.PI, 0, false);
    g.strokePath();
  }

  shakeLockedNode(target, originX) {
    this.tweens.add({
      targets: target,
      x: originX + 6,
      duration: 45,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        target.x = originX;
      },
    });
  }

  // --- HUD ------------------------------------------------------------------

  createHud() {
    const { width } = this.scale;
    const bar = this.add.rectangle(0, 0, width, 56, APP_BG_COLOR, 0.85).setOrigin(0);
    bar.setScrollFactor(0);

    const title = this.add.text(width / 2, 28, this.world.name, {
      fontFamily: 'Arial',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    title.setOrigin(0.5);
    title.setScrollFactor(0);

    const backButton = this.add
      .text(16, 28, '\u2190 Back', {
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
      this.goBack();
    });
  }

  // --- Navigation ---------------------------------------------------------

  selectLevel(levelNum) {
    const levelId = levelIdFor(this.worldId, levelNum);
    this.cameras.main.fadeOut(220, ...APP_BG_COLOR_RGB);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('BoardScene', { levelId, worldId: this.worldId, levelNum });
    });
  }

  goBack() {
    this.cameras.main.fadeOut(220, ...APP_BG_COLOR_RGB);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('WorldSelectScene');
    });
  }
}
