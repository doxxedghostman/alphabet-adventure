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
// Nodes render as one of three real icon images (public/assets/icons/
// node-{locked,unlocked,complete}.png - see chat for the generation
// prompts and how the checkerboard "transparency" the generator baked
// in was removed) swapped per node based on progress, rather than
// code-drawn circles. The level number is still drawn as text on top
// of the unlocked icon (its center is intentionally blank in the art
// for exactly this).
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
    this.load.image('node-unlocked', 'assets/icons/node-unlocked.png');
    this.load.image('node-locked', 'assets/icons/node-locked.png');
    this.load.image('node-complete', 'assets/icons/node-complete.png');
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
    const baseSize = isBoss ? 92 : 72; // on-screen diameter in px

    const textureKey = !unlocked ? 'node-locked' : complete ? 'node-complete' : 'node-unlocked';
    const icon = this.add.image(x, y, textureKey);
    icon.setDisplaySize(baseSize, baseSize);

    // Unlocked-but-not-complete nodes still need the level number -
    // it isn't baked into node-unlocked.png (see the generation
    // prompt in chat: center's left blank on purpose so it can be
    // drawn per-level here).
    if (unlocked && !complete) {
      this.add
        .text(x, y, String(levelNum), {
          fontFamily: 'Arial',
          fontSize: isBoss ? '26px' : '20px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#c0158f',
          strokeThickness: 3,
        })
        .setOrigin(0.5);
    }

    const radius = baseSize / 2;
    const hitArea = this.add
      .circle(x, y, radius + 6, 0xffffff, 0)
      .setInteractive({ useHandCursor: unlocked });

    hitArea.on('pointerup', () => {
      if (this.wasDrag()) return;
      if (unlocked) this.selectLevel(levelNum);
      else this.shakeLockedNode(icon, x);
    });
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
